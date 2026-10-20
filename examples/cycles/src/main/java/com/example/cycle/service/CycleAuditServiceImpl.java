package com.example.cycle.service;

import com.example.cycle.mapper.CycleMapper;
import org.springframework.stereotype.Service;

@Service
public class CycleAuditServiceImpl implements CycleService {

    private final CycleMapper cycleMapper;

    public CycleAuditServiceImpl(CycleMapper cycleMapper) {
        this.cycleMapper = cycleMapper;
    }

    @Override
    public void a() {
        cycleMapper.log();
    }
}
