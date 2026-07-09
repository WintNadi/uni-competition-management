package com.project.Backend.Common.util;

import java.time.LocalDateTime;

public final class DateUtils {
    private DateUtils() {}

    public static LocalDateTime nowUtc() {
        return LocalDateTime.now();
    }
}
