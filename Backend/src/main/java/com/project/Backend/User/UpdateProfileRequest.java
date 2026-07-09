package com.project.Backend.User;

import jakarta.validation.constraints.Size;

public class UpdateProfileRequest {
    @Size(max = 100)
    private String fullName;
    @Size(max = 20)
    private String phone;
    @Size(max = 100)
    private String department;
    @Size(max = 255)
    private String avatarUrl;
    @Size(max = 500)
    private String bio;

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }

    public String getBio() {
        return bio;
    }

    public void setBio(String bio) {
        this.bio = bio;
    }
}
