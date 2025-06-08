---
layout: page
title: "时空数据挖掘领域学者"
permalink: /spatial-temporal-scholars/
---

<div class="scholars-container">
  {% for scholar in site.data.spatial_temporal_scholars.scholars %}
  <div class="scholar-card">
    <h3>{{ scholar.name }}</h3>
    <p class="institution">{{ scholar.institution }}</p>
    <p class="field">研究领域：{{ scholar.field }}</p>
    <p class="h-index">h指数：{{ scholar.h_index }}</p>
    <p class="description">{{ scholar.description }}</p>
    <a href="{{ scholar.google_scholar }}" target="_blank" class="scholar-link">查看谷歌学术主页</a>
  </div>
  {% endfor %}
</div>

<style>
.scholars-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 2rem;
  padding: 2rem 0;
}

.scholar-card {
  border: 1px solid #eaecef;
  border-radius: 8px;
  padding: 1.5rem;
  transition: transform 0.2s;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.scholar-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.scholar-card h3 {
  margin: 0.5rem 0;
  color: #24292e;
}

.institution {
  color: #586069;
  font-size: 0.9rem;
  margin: 0.5rem 0;
}

.field {
  color: #0366d6;
  font-size: 0.9rem;
  margin: 0.5rem 0;
}

.h-index {
  color: #666;
  font-size: 0.9rem;
  margin: 0.5rem 0;
}

.description {
  font-size: 0.9rem;
  color: #24292e;
  margin: 1rem 0;
}

.scholar-link {
  display: inline-block;
  padding: 0.5rem 1rem;
  background-color: #0366d6;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  margin-top: 1rem;
  transition: background-color 0.2s;
}

.scholar-link:hover {
  background-color: #0256b3;
}
</style>