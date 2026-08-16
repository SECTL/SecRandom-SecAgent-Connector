---
name: secrandom
description: 操作本机 SecRandom 名单和抽人功能；调用任何 SecRandom 隐藏工具前必须先读取本 Skill。
---

# SecRandom 点名联动

本 Skill 适用于用户明确要求读取、录入、修改名单或抽取 SecRandom 学生时。

## 必须遵守

修改名单前，必须先读取本 Skill：

- `secrandom__list_students`
- `secrandom__upsert_student`
- `secrandom__remove_student`

工具通过 `secagent__call_hidden_tool` 调用。名单变更前应向用户确认将要新增、更新或删除的内容；不要把用户没有提供的名单字段臆造出来。

`secrandom__draw_students` 是可直接调用的普通工具，不要求先读取本 Skill。

## 抽人

`secrandom__draw_students` 必须传 `mode`：

- `flash`：只允许抽 1 人，SecRandom 会执行原本的 QuickDraw 通知渠道。
- `result_only`：执行抽取但不发送通知，只把抽取结果作为工具返回。

两种模式都支持 `count`（1 到 100；`flash` 会强制为 1）以及可选范围：
`include_tags`、`exclude_tags`、`include_ids`、`include_names`。范围条件会在 SecRandom 端执行。

## 返回值

抽人结果包含 `mode`、`count`、`status`、`profile` 和 `students`。名单读取返回当前配置档案及 `students`；名单写入/删除返回变更后的学生和档案名。
