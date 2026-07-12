# src/repositories

データアクセス層。データソース（端末内 / バックエンド）の詳細を隠蔽し、ドメイン型で入出力する。

想定リポジトリ: `projectRepository`（expo-sqlite、Phase 1）、`postRepository`/`userRepository` 等（Convex、Phase 5）

ルール: SQLやConvexクエリはこの層に閉じ込める。feature/UIはリポジトリのメソッドのみ使う。
