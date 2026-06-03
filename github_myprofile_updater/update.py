import re

def clean_markdown(text):
    """Remove Jekyll/Liquid tags and kramdown directives"""
    # Remove kramdown options like {::options parse_block_html="true" /}
    text = re.sub(r'\{::options[^}]*\}', '', text)
    # Remove Liquid capture tags like {% capture xxx %}
    text = re.sub(r'\{%\s*capture[^%]*%\}', '', text)
    # Remove Liquid endcapture tags
    text = re.sub(r'\{%\s*endcapture\s*%\}', '', text)
    # Remove Liquid variable assignments like {{ site.author.xxx }}
    text = re.sub(r'\{\{\s*[^}]+\s*\}\}', '', text)
    # Remove Liquid if/else/endif tags
    text = re.sub(r'\{%\s*(if|else|endif|for|endfor)[^%]*%\}', '', text)
    # Remove empty lines that result from removing tags
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

if __name__ == '__main__':
    _header = '## Hi there 👋'
    base_dir = '../_pages/includes/'
    _intro = open(f'{base_dir}/intro.md', encoding='utf-8').read().strip()
    _homepage = open(f'{base_dir}/homepage.md', encoding='utf-8').read().strip()
    _news = open(f'{base_dir}/news.md', encoding='utf-8').read().strip()
    
    # Clean all markdown content
    _intro = clean_markdown(_intro)
    _homepage = clean_markdown(_homepage)
    _news = clean_markdown(_news)
    
    with open('README.md', 'w', encoding='utf-8') as f:
        f.write(_header)
        f.write('\n\n')
        f.write(_intro)
        f.write('\n\n##')
        f.write(_homepage)
        f.write('\n\n##')
        f.write(_news)
