package com.example.cycle.service;

import org.springframework.stereotype.Service;

@Service
public class CycleServiceImpl implements CycleService {

    @Override
    public void a() {
        b();
    }

    private void b() {
        a();
    }
}
