package com.example.order.service;

import com.example.order.dto.Order;

import java.util.List;

public interface OrderService {
    List<Order> list(String name);

    void fillCreatorNames(List<Order> orders);
}
