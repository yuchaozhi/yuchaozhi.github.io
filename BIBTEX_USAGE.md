# BibTeX 引用使用说明

## 概述
现在你可以使用 `\cite{key}` 语法来引用BibTeX条目，系统会自动将引用转换为BibTeX按钮。

## 使用方法

### 1. 在Markdown文件中使用
在任意位置添加 `\cite{key}` 即可：

```markdown
- ``IEEE SPL`` Multi-Scale Cross-Dimensional Attention Network for Gland Segmentation. **Chaozhi Yu**, Hongnan Cheng, Yufei Huang, Zhizhe Lin, Teng Zhou. 2025. https://doi.org/10.1109/LSP.2025.3600374 [SCI Q2, 中科院三区] \cite{yu2025multi}
```

### 2. 添加新的BibTeX条目
要添加新的BibTeX条目，需要：

1. **在 `_includes/head.html` 中的 `bibtexDatabase` 对象中添加新条目**：
```javascript
var bibtexDatabase = {
  "your_new_key": `@article{your_new_key,
  title={Your Paper Title},
  author={Author, Name},
  journal={Journal Name},
  year={2025},
  publisher={Publisher}
}`,
  // ... 其他条目
};
```

2. **在Markdown文件中使用**：
```markdown
你的论文描述 \cite{your_new_key}
```

### 3. 从 reference.bib 导入
如果你想从 `reference.bib` 文件导入BibTeX条目：

1. 从 `reference.bib` 复制BibTeX条目
2. 将条目添加到 `bibtexDatabase` 中
3. 使用 `\cite{key}` 引用

### 4. 功能特点
- ✅ **简单语法**：只需使用 `\cite{key}` 即可
- ✅ **自动转换**：页面加载时自动转换为BibTeX按钮
- ✅ **复制功能**：一键复制BibTeX内容
- ✅ **格式统一**：所有BibTeX条目使用相同格式

### 5. 示例
```markdown
# 论文列表

- 论文1描述 \cite{paper1_key}
- 论文2描述 \cite{paper2_key}
- 论文3描述 \cite{paper3_key}
```

页面加载后，`\cite{key}` 会被自动替换为BibTeX按钮和内容。

### 6. 注意事项
- 确保 `bibtexDatabase` 中包含对应的key
- 重启Jekyll服务器以加载新的BibTeX条目
- 如果key不存在，`\cite{key}` 会保持原样显示