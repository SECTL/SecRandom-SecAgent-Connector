# SecRandom-SecAgent-Connector

SecAgent 插件，通过 SecRandom 的本机 loopback HTTP 接口提供名单管理和抽人隐藏工具。

插件默认访问 `http://127.0.0.1:3910/api/secagent/v1`。安装后会自动探测 SecRandom；SecRandom 未运行时工具不会注册，避免产生误调用。抽人工具是可见工具，名单管理工具保持隐藏。

构建：

```text
npm install
npm run build
```
