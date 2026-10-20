package com.example.order.dto;

public class Order {
    private Long id;
    private String name;
    private String creator;
    private String creatorName;

    public String getCreator() {
        return creator;
    }

    public void setCreatorName(String creatorName) {
        this.creatorName = creatorName;
    }
}
