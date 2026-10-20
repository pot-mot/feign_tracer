package com.example.user.service;

import com.example.common.dto.User;
import com.example.user.mapper.UserMapper;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UserServiceImpl implements UserService {

    private final UserMapper userMapper;

    public UserServiceImpl(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    @Override
    public User getUser(Long id) {
        return userMapper.findById(id);
    }

    @Override
    public List<User> listUsers(String name) {
        return userMapper.listUsers(name);
    }
}
