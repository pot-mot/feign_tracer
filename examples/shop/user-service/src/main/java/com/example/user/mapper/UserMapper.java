package com.example.user.mapper;

import com.example.common.dto.User;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface UserMapper {
    User findById(Long id);

    List<User> listUsers(String name);
}
