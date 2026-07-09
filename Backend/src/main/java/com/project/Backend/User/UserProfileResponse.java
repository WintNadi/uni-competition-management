package com.project.Backend.User;

import java.util.List;

public class UserProfileResponse {
    private String id;
    private String username;
    private String email;
    private String fullName;
    private String phone;
    private String department;
    private String avatarUrl;
    private String bio;
    private List<String> roles;

    public UserProfileResponse() {}

    public UserProfileResponse(String id, String username, String email, String fullName, String phone, String department, String avatarUrl, String bio, List<String> roles) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.fullName = fullName;
        this.phone = phone;
        this.department = department;
        this.avatarUrl = avatarUrl;
        this.bio = bio;
        this.roles = roles;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }
    public List<String> getRoles() { return roles; }
    public void setRoles(List<String> roles) { this.roles = roles; }
}
