package com.example.user.service;

import com.example.common.dto.User;

import java.util.List;

public interface UserService {
    User getUser(Long id);

    List<User> listUsers(String name);
}
