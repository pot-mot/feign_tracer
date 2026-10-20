package com.example.app

import com.example.lib.Greeter
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/demo")
class DemoController(private val demoService: DemoService) {

    @GetMapping("/hello")
    fun hello(@RequestParam("name") name: String): String {
        return demoService.hello(name)
    }
}

@org.springframework.stereotype.Service
class DemoService(private val greeter: Greeter) {

    fun hello(name: String): String {
        return greeter.greet(name)
    }
}
