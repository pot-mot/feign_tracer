package com.example.order.client;

import com.example.common.dto.User;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

@FeignClient(name = "user-service", path = "/users")
public interface UserClient {

    @GetMapping("/list")
    List<User> listUsers(@RequestParam("name") String name);

    @GetMapping("/{id}")
    User getUser(@RequestParam("id") Long id);
}
