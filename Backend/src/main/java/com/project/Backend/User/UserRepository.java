package com.project.Backend.User;

import com.project.Backend.User.User;
import com.project.Backend.Auth.Role;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findByUsername(String username);
    
    Optional<User> findByEmail(String email);

    Boolean existsByUsername(String username);

    Boolean existsByEmail(String email);

    List<User> findByRoles(Role role);

    @Query("{'roles': ?0, '$or': ["
            + "{'username': {'$regex': ?1, '$options': 'i'}},"
            + "{'email': {'$regex': ?1, '$options': 'i'}},"
            + "{'fullName': {'$regex': ?1, '$options': 'i'}}"
            + "]}")
    List<User> searchStudents(Role role, String query);
}
