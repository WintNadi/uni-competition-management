package com.project.Backend.Support;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "support_conversations")
public class SupportConversation {

    @Id
    private String id;

    private String studentId;

    private String adminId; // first admin who replied, optional

    private String subject;

    private String status = "OPEN"; // OPEN, CLOSED

    @CreatedDate
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private LocalDateTime lastMessageAt;

    private int unreadForStudent;

    private int unreadForAdmin;

    private List<SupportMessage> messages = new ArrayList<>();

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getStudentId() {
        return studentId;
    }

    public void setStudentId(String studentId) {
        this.studentId = studentId;
    }

    public String getAdminId() {
        return adminId;
    }

    public void setAdminId(String adminId) {
        this.adminId = adminId;
    }

    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public LocalDateTime getLastMessageAt() {
        return lastMessageAt;
    }

    public void setLastMessageAt(LocalDateTime lastMessageAt) {
        this.lastMessageAt = lastMessageAt;
    }

    public int getUnreadForStudent() {
        return unreadForStudent;
    }

    public void setUnreadForStudent(int unreadForStudent) {
        this.unreadForStudent = unreadForStudent;
    }

    public int getUnreadForAdmin() {
        return unreadForAdmin;
    }

    public void setUnreadForAdmin(int unreadForAdmin) {
        this.unreadForAdmin = unreadForAdmin;
    }

    public List<SupportMessage> getMessages() {
        return messages;
    }

    public void setMessages(List<SupportMessage> messages) {
        this.messages = messages;
    }

    public static class SupportMessage {

        private String id;

        private String senderId;

        private String senderRole; // STUDENT or ADMIN

        private String text;

        private LocalDateTime createdAt;

        private boolean readByStudent;

        private boolean readByAdmin;

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public String getSenderId() {
            return senderId;
        }

        public void setSenderId(String senderId) {
            this.senderId = senderId;
        }

        public String getSenderRole() {
            return senderRole;
        }

        public void setSenderRole(String senderRole) {
            this.senderRole = senderRole;
        }

        public String getText() {
            return text;
        }

        public void setText(String text) {
            this.text = text;
        }

        public LocalDateTime getCreatedAt() {
            return createdAt;
        }

        public void setCreatedAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
        }

        public boolean isReadByStudent() {
            return readByStudent;
        }

        public void setReadByStudent(boolean readByStudent) {
            this.readByStudent = readByStudent;
        }

        public boolean isReadByAdmin() {
            return readByAdmin;
        }

        public void setReadByAdmin(boolean readByAdmin) {
            this.readByAdmin = readByAdmin;
        }
    }
}

