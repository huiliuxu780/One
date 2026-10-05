package com.hxh.apboa.common.config.mybatis;

import com.hxh.apboa.common.util.JsonUtils;
import com.baomidou.mybatisplus.extension.handlers.AbstractJsonTypeHandler;
import com.fasterxml.jackson.databind.JsonNode;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.type.MappedJdbcTypes;
import org.apache.ibatis.type.MappedTypes;

/**
 * 描述：JSON 节点类型处理器
 *
 * @author huxuehao
 */
@MappedTypes(value = { Object.class, JsonNode.class})
@MappedJdbcTypes(value = { JdbcType.VARCHAR, JdbcType.LONGVARCHAR, JdbcType.OTHER })
public class JsonNodeTypeHandler extends AbstractJsonTypeHandler<Object> {

    public JsonNodeTypeHandler(Class<?> type) {
        super(type);
    }

    @Override
    public Object parse(String json) {
        try {
            return JsonUtils.parse(json);
        } catch (RuntimeException ignored) {
            // 早期执行记可能把纯文本直接写入 JSON 列。读取时将其视为 JSON 字符串，
            // 避免一条历史记录使整个详情接口失败。
            return JsonUtils.valueToTree(json);
        }
    }

    @Override
    public String toJson(Object  obj) {
       return JsonUtils.toJsonStr(obj);
    }
}
