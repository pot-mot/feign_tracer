import type {
    AnalysisResult,
    AnnotationInfo,
    EndpointInfo,
    FeignOperation,
    MethodInfo,
    TypeInfo,
} from "../model.ts";
import {
    getAnnotation,
    hasAnnotation,
    methodLabel,
    normalizePath,
    pathMatches,
    simpleTypeName,
    stringValues,
    unquote,
} from "../languages/common.ts";
import { flattenTypes, type ProjectIndex } from "./index.ts";
import { paramsOf, visibilityOf } from "./display.ts";

const MAPPING_METHODS: Record<string, string> = {
    GetMapping: "GET",
    PostMapping: "POST",
    PutMapping: "PUT",
    DeleteMapping: "DELETE",
    PatchMapping: "PATCH",
};

const JAXRS_METHODS = new Set(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]);

interface Mapping {
    httpMethods: string[];
    paths: string[];
}

export interface EndpointBuildResult {
    endpoints: EndpointInfo[];
    feignClients: AnalysisResult["feignClients"];
    feignOperations: FeignOperation[];
}

export const buildEndpoints = (index: ProjectIndex): EndpointBuildResult => {
    const endpoints: EndpointInfo[] = [];
    const feignClients: AnalysisResult["feignClients"] = [];
    const feignOperations: FeignOperation[] = [];

    for (const file of index.files) {
        for (const type of flattenTypes(file.types)) {
            const isController =
                hasAnnotation(type.annotations, "RestController", "Controller") ||
                (hasAnnotation(type.annotations, "Path") &&
                    type.methods.some((method) => hasJaxrsMethod(method)));
            const isFeign = hasAnnotation(type.annotations, "FeignClient");

            if (isController) {
                const classMappings = mappingOf(type.annotations, true);
                const classPrefixes = classMappings.flatMap((mapping) => mapping.paths);
                const prefixes = classPrefixes.length > 0 ? classPrefixes : [""];

                for (const method of type.methods) {
                    if (method.isConstructor) continue;
                    const methodMappings = mappingOf(method.annotations, false);
                    for (const mapping of methodMappings) {
                        const methodPaths = mapping.paths.length > 0 ? mapping.paths : [""];
                        for (const prefix of prefixes) {
                            for (const methodPath of methodPaths) {
                                const path = joinPaths(prefix, methodPath);
                                for (const httpMethod of mapping.httpMethods) {
                                    endpoints.push(makeEndpoint(type, method, httpMethod, path));
                                }
                            }
                        }
                    }
                }
            }

            if (isFeign) {
                const client = getAnnotation(type.annotations, "FeignClient");
                if (!client) continue;
                const serviceName =
                    firstString(client.args.name) ??
                    firstString(client.args.value) ??
                    firstString(client.args.serviceId);
                const url = firstString(client.args.url);
                const clientPath = firstString(client.args.path) ?? "";
                const classPrefixes = [
                    clientPath,
                    ...mappingOf(type.annotations, true).flatMap((mapping) => mapping.paths),
                ].filter((value) => value !== undefined);
                const prefixes = classPrefixes.length > 0 ? classPrefixes : [""];

                const clientInfo: AnalysisResult["feignClients"][number] = {
                    id: type.fqn,
                    name: type.name,
                    serviceName,
                    url,
                    moduleId: type.moduleId,
                    file: type.filePath,
                    line: type.line,
                    methods: [],
                };

                for (const method of type.methods) {
                    if (method.isConstructor) continue;
                    const methodMappings = mappingOf(method.annotations, false);
                    if (methodMappings.length === 0) continue;

                    const paths: string[] = [];
                    for (const mapping of methodMappings) {
                        const methodPaths = mapping.paths.length > 0 ? mapping.paths : [""];
                        for (const prefix of prefixes) {
                            for (const methodPath of methodPaths) {
                                paths.push(joinPaths(prefix, methodPath));
                            }
                        }
                    }
                    const httpMethod = methodMappings[0].httpMethods[0] ?? "ANY";
                    const uniquePaths = [...new Set(paths)];

                    for (const path of uniquePaths) {
                        feignOperations.push({
                            client: type.name,
                            serviceName,
                            url,
                            method: method.name,
                            httpMethod,
                            path,
                            id: method.id,
                            moduleId: type.moduleId,
                            file: type.filePath,
                            line: method.line,
                            targetEndpoints: [],
                        });
                    }

                    clientInfo.methods.push({
                        id: method.id,
                        name: method.name,
                        httpMethod,
                        paths: uniquePaths,
                        signature: signatureOf(method),
                    });
                }

                if (clientInfo.methods.length > 0) feignClients.push(clientInfo);
            }
        }
    }

    return { endpoints, feignClients, feignOperations };
};

export const linkFeignEndpoints = (
    index: ProjectIndex,
    endpoints: EndpointInfo[],
    operations: FeignOperation[],
): void => {
    for (const operation of operations) {
        const candidates = endpoints.filter((endpoint) => {
            if (endpoint.handler === operation.id) return false;
            if (!pathMatches(operation.path, endpoint.paths[0] ?? "/")) return false;
            return (
                operation.httpMethod === "ANY" ||
                endpoint.httpMethod === "ANY" ||
                operation.httpMethod === endpoint.httpMethod
            );
        });
        const preferred = preferService(candidates, operation, index);
        operation.targetEndpoints = [
            ...new Set(preferred.map((endpoint) => `${endpoint.id}::${endpoint.handler}`)),
        ];
    }
};

const preferService = (
    endpoints: EndpointInfo[],
    operation: FeignOperation,
    index: ProjectIndex,
): EndpointInfo[] => {
    if (endpoints.length <= 1) return endpoints;
    const service = operation.serviceName;
    if (service) {
        const normalized = normalizeService(service);
        const matching = endpoints.filter((endpoint) => {
            const module = index.moduleById.get(endpoint.moduleId ?? "");
            if (!module) return false;
            return (
                normalizeService(module.name) === normalized ||
                normalizeService(module.artifactId ?? "") === normalized ||
                normalizeService(module.id) === normalized
            );
        });
        if (matching.length > 0) return matching;
    }
    return [endpoints[0]];
};

const normalizeService = (value: string): string => {
    return value.toLowerCase().replace(/[-_.]/g, "");
};

const makeEndpoint = (
    type: TypeInfo,
    method: MethodInfo,
    httpMethod: string,
    path: string,
): EndpointInfo => {
    const normalized = normalizePath(path);
    const id = `${httpMethod === "ANY" ? "ANY" : httpMethod.toUpperCase()} ${normalized}`;
    return {
        id,
        httpMethod: httpMethod === "ANY" ? "ANY" : httpMethod.toUpperCase(),
        paths: [normalized],
        handler: method.id,
        handlerLabel: methodLabel(type.name, method.name, method.params),
        controller: type.fqn,
        moduleId: type.moduleId,
        file: type.filePath,
        line: method.line,
        treeBuilt: false,
        tree: {
            seq: "0",
            path: "(0)",
            order: 0,
            depth: 0,
            id: method.id,
            label: methodLabel(type.name, method.name, method.params),
            signature: signatureOf(method),
            params: paramsOf(method),
            visibility: visibilityOf(method, type.filePath),
            kind: "controller",
            moduleId: type.moduleId,
            file: type.filePath,
            line: method.line,
            children: [],
        },
    };
};

const mappingOf = (annotations: AnnotationInfo[], isClass: boolean): Mapping[] => {
    const withMethods: Mapping[] = [];
    const pathOnly: Mapping[] = [];

    for (const annotation of annotations) {
        const direct = MAPPING_METHODS[annotation.name];
        if (direct) {
            withMethods.push({ httpMethods: [direct], paths: annotationPaths(annotation) });
            continue;
        }

        if (annotation.name === "RequestMapping") {
            const methods = httpMethods(annotation);
            const mapping = {
                httpMethods: methods.length > 0 ? methods : ["ANY"],
                paths: annotationPaths(annotation),
            };
            if (methods.length > 0) withMethods.push(mapping);
            else pathOnly.push(mapping);
            continue;
        }

        if (annotation.name === "Path") {
            pathOnly.push({ httpMethods: ["ANY"], paths: annotationPaths(annotation) });
            continue;
        }

        if (JAXRS_METHODS.has(annotation.name)) {
            withMethods.push({ httpMethods: [annotation.name], paths: [] });
        }
    }

    if (withMethods.length > 0) {
        if (!isClass) {
            const inheritedPaths = pathOnly.flatMap((mapping) => mapping.paths);
            for (const mapping of withMethods) {
                if (mapping.paths.length === 0 && inheritedPaths.length > 0) {
                    mapping.paths = inheritedPaths;
                }
            }
        }
        return withMethods;
    }
    return pathOnly;
};

const annotationPaths = (annotation: AnnotationInfo): string[] => {
    const value = annotation.args.value ?? annotation.args.path ?? annotation.args.value0;
    return stringValues(value)
        .map((item) => unquote(item))
        .filter(Boolean);
};

const httpMethods = (annotation: AnnotationInfo): string[] => {
    const raw = annotation.args.method;
    if (!raw) return [];
    const result = [
        ...raw.matchAll(/RequestMethod\s*\.\s*(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE)/g),
    ].map((match) => match[1]);
    if (result.length > 0) return [...new Set(result)];
    const plain = [...raw.matchAll(/\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE)\b/g)].map(
        (match) => match[1],
    );
    return [...new Set(plain)];
};

const firstString = (value: string | undefined): string | undefined => {
    const values = stringValues(value);
    return values.length > 0 ? unquote(values[0]) : undefined;
};

const joinPaths = (...parts: Array<string | undefined>): string => {
    const cleaned = parts
        .filter((part): part is string => part !== undefined)
        .map((part) => part.trim().replace(/^\/+|\/+$/g, ""))
        .filter(Boolean);
    return normalizePath(cleaned.join("/"));
};

const hasJaxrsMethod = (method: MethodInfo): boolean => {
    return method.annotations.some((annotation) => JAXRS_METHODS.has(annotation.name));
};

export const signatureOf = (method: MethodInfo): string => {
    const params = method.params
        .map((param) => param.type || simpleTypeName(param.type))
        .join(", ");
    return `${method.ownerFqn}#${method.name}(${params})`;
};
