package com.hxh.apboa.resource.storage.config;

import lombok.Getter;
import lombok.Setter;

/**
 * 描述：本地存储（LOCAL）
 *
 * @author huxuehao
 **/
@Setter
@Getter
public class LocalStorageConfig {
    /**
     * Relative to the service working directory. Docker services run from /app
     * and share /app/.apboa, so Console and Runtime see the same files.
     */
    private String localDir = ".apboa/storage";
}
