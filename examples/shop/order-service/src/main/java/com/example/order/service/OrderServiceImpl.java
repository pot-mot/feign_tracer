package com.example.order.service;

import com.example.common.dto.User;
import com.example.order.client.UserClient;
import com.example.order.dto.Order;
import com.example.order.mapper.OrderMapper;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class OrderServiceImpl implements OrderService {

    private final OrderMapper orderMapper;
    private final UserClient userClient;

    public OrderServiceImpl(OrderMapper orderMapper, UserClient userClient) {
        this.orderMapper = orderMapper;
        this.userClient = userClient;
    }

    @Override
    public List<Order> list(String name) {
        return orderMapper.list(name);
    }

    @Override
    public void fillCreatorNames(List<Order> orders) {
        for (Order order : orders) {
            User user = userClient.listUsers(order.getCreator());
            order.setCreatorName(user.getName());
        }
    }
}
