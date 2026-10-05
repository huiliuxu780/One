package com.hxh.apboa.agent.service.impl;

import com.hxh.apboa.agent.mapper.ChatMessageMapper;
import com.hxh.apboa.agent.service.ChatMessageService;
import com.hxh.apboa.common.entity.ChatMessage;
import com.hxh.apboa.common.router.MessageTableRouter;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;

/**
 * 聊天消息 Service 实现
 *
 * @author huxuehao
 */
@Service
@RequiredArgsConstructor
public class ChatMessageServiceImpl extends ServiceImpl<ChatMessageMapper, ChatMessage> implements ChatMessageService {

    private final MessageTableRouter messageTableRouter;

    @Override
    public List<ChatMessage> listByIdsOrderByDepth(List<Integer> ids) {
        if (ids == null || ids.isEmpty()) {
            return Collections.emptyList();
        }
        return lambdaQuery()
                .in(ChatMessage::getId, ids)
                .orderByAsc(ChatMessage::getDepth)
                .list();
    }

    @Override
    public List<ChatMessage> listByIdsOrderByDepth(List<Integer> ids, String messageTable) {
        if (ids == null || ids.isEmpty()) {
            return Collections.emptyList();
        }
        // 如果未指定归档表，走主表 MyBatis-Plus 查询
        if (messageTable == null || messageTable.isBlank()) {
            return listByIdsOrderByDepth(ids);
        }
        // 已归档：走 MessageTableRouter 查询归档表
        return messageTableRouter.listByIdsOrderByDepth(ids, messageTable);
    }

    @Override
    public List<ChatMessage> listBySessionId(Long sessionId, String messageTable) {
        if (sessionId == null) {
            return Collections.emptyList();
        }
        if (messageTable == null || messageTable.isBlank()) {
            return lambdaQuery()
                    .eq(ChatMessage::getSessionId, sessionId)
                    .orderByAsc(ChatMessage::getDepth)
                    .orderByAsc(ChatMessage::getId)
                    .list();
        }
        return messageTableRouter.listBySessionId(sessionId, messageTable);
    }
}
