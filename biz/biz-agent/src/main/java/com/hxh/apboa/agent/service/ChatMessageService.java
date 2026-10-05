package com.hxh.apboa.agent.service;

import com.hxh.apboa.common.entity.ChatMessage;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.List;

/**
 * 聊天消息 Service
 *
 * @author huxuehao
 */
public interface ChatMessageService extends IService<ChatMessage> {

    /**
     * 根据路径上的 id 列表查询消息，按 depth 升序（回显当前完整对话，O(depth)）
     *
     * @param ids 路径拆分出的消息 id 列表
     * @return 按深度排序的消息列表
     */
    List<ChatMessage> listByIdsOrderByDepth(List<Integer> ids);

    /**
     * 根据路径上的 id 列表从指定表查询消息，按 depth 升序（支持归档表路由）
     *
     * @param ids          路径拆分出的消息 id 列表
     * @param messageTable 消息所在表名（null 或空 = chat_message 主表）
     * @return 按深度排序的消息列表
     */
    List<ChatMessage> listByIdsOrderByDepth(List<Integer> ids, String messageTable);

    /** 读取会话完整消息树，支持主表与归档表。 */
    List<ChatMessage> listBySessionId(Long sessionId, String messageTable);
}
