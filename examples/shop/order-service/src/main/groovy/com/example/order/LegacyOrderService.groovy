package com.example.order

import com.example.order.mapper.OrderMapper
import com.example.order.dto.Order
import org.springframework.stereotype.Service

@Service
class LegacyOrderService {

    private final OrderMapper orderMapper

    LegacyOrderService(OrderMapper orderMapper) {
        this.orderMapper = orderMapper
    }

    List<Order> list(String name) {
        return orderMapper.list(name)
    }
}
