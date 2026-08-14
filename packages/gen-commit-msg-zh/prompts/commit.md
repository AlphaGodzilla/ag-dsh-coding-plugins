用户已选择提交。请先运行 `git status`（或 `git diff --staged --stat`）判断是否已有暂存改动:
- 若**无**已暂存改动: 执行 `git add -A`（若我在上文附加要求中指定了提交范围, 则按该范围 add）后再提交;
- 若**已有**暂存改动: 不要再 add, 直接对已暂存内容提交。
用你上面生成的 commit message 执行 `git commit`; sandbox 环境用多个 `-m`（首个为标题, 其余为正文）, 不要加任何广告尾注。
