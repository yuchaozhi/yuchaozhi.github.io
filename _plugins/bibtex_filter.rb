module Jekyll
  module BibtexFilter
    def bibtex_reference(bibtex_key)
      # 读取reference.bib文件
      bib_file = File.join(@context.registers[:site].source, 'reference.bib')
      return "" unless File.exist?(bib_file)
      
      bib_content = File.read(bib_file)
      
      # 查找对应的BibTeX条目
      bibtex_entry = extract_bibtex_entry(bib_content, bibtex_key)
      return "" if bibtex_entry.empty?
      
      # 生成唯一的ID
      entry_id = "bibtex-#{bibtex_key}"
      
      # 生成HTML
      html = <<~HTML
        <button class="bibtex-btn" onclick="toggleBibtex('#{entry_id}')">BibTeX</button>
        <div id="#{entry_id}" class="bibtex-content" style="display: none;">
          <pre>#{bibtex_entry}</pre>
          <button class="copy-btn" onclick="copyBibtex('#{entry_id}')">复制</button>
        </div>
      HTML
      
      html
    end
    
    private
    
    def extract_bibtex_entry(content, key)
      # 使用正则表达式提取BibTeX条目
      pattern = /@\w+\s*\{\s*#{Regexp.escape(key)}\s*,[\s\S]*?(?=@\w+\s*\{|\z)/
      match = content.match(pattern)
      
      if match
        # 清理和格式化BibTeX条目
        entry = match[0].strip
        # 确保条目以}结尾
        entry += "}" unless entry.end_with?("}")
        return entry
      end
      
      ""
    end
  end
end

Liquid::Template.register_filter(Jekyll::BibtexFilter)