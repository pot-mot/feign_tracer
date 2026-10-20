plugins {
    kotlin("jvm") version "1.9.24"
    id("org.springframework.boot") version "3.2.0"
}

dependencies {
    implementation(project(":lib"))
    implementation("org.springframework.boot:spring-boot-starter-web")
    testImplementation(project(":lib"))
    implementation(platform("org.springframework.cloud:spring-cloud-dependencies:2023.0.0"))
}
