package com.project.Backend.Auth;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

@Component
public class RoleGuard {
    public boolean hasRole(Authentication authentication, String role) {
        if (authentication == null || role == null) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals(role));
    }
}
