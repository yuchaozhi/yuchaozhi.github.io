<h1 align="center">
My Personal Academic Homepage
</h1>

<div align="center">

[![Profile Views](https://komarev.com/ghpvc/?username=yuchaozhi&label=Profile%20views&color=0e75b6&style=flat)](https://github.com/yuchaozhi/yuchaozhi.github.io)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/yuchaozhi/yuchaozhi.github.io)
[![](https://img.shields.io/github/license/yuchaozhi/yuchaozhi.github.io)](https://github.com/yuchaozhi/yuchaozhi.github.io/blob/main/LICENSE)
[![中文文档](https://img.shields.io/badge/语言-切换中文-0366d6?style=flat-square&logo=github&logoColor=white)](./docs/README-zh.md)

</div>

<p>Welcome to my personal academic homepage. Here you can find my research projects, publications, and other academic activities.
</p>

<p align="center">
    <br>
    <img src="docs/screenshot.png" width="100%"/>
    <br>
</p>

- [Personal Homepage of the author](https://yuchaozhi.github.io/)

For a detailed explanation of the design and implementation of this personal academic homepage, please refer to this [url](https://deepwiki.com/yuchaozhi/yuchaozhi.github.io).

## Key Features

- **Automatically update google scholar citations**: using the google scholar crawler and github action, this REPO can update the author citations and publication citations automatically.
- **Support Google analytics**: you can trace the traffics of your homepage by easy configuration.
- **Responsive**: this homepage automatically adjust for different screen sizes and viewports.
- **Beautiful and Simple Design**: this homepage is beautiful and simple, which is very suitable for academic personal homepage.
- **SEO**: search Engine Optimization (SEO) helps search engines find the information you publish on your homepage easily, then rank it against similar websites.

## Quick Start

1. Fork this REPO and rename to `USERNAME.github.io`, where `USERNAME` is your github USERNAME.
2. Configure the google scholar citation crawler:
   1. Find your google scholar ID in the url of your google scholar page (e.g., https://scholar.google.com/citations?user=SCHOLAR_ID), where `SCHOLAR_ID` is your google scholar ID.
   2. Set GOOGLE_SCHOLAR_ID variable to your google scholar ID in `Settings -> Secrets -> Actions -> New repository secret` of the REPO website with `name=GOOGLE_SCHOLAR_ID` and `value=SCHOLAR_ID`.
   3. Click the `Action` of the REPO website and enable the workflows by clicking *"I understand my workflows, go ahead and enable them"*. This github action will generate google scholar citation stats data `gs_data.json` in `google-scholar-stats` branch of your REPO. When you update your main branch, this action will be triggered. This action will also be trigger 08:00 UTC everyday.
3. Generate favicon using [favicon-generator](https://redketchup.io/favicon-generator) and download all generated files to `REPO/images`.
4. Modify the configuration of your homepage `_config.yml`:
   1. `title`: the title of your homepage
   2. `description`: the description of your homepage
   3. `repository`: USER_NAME/REPO_NAME
   4. `google_analytics_id` (optional): google analytics ID
   5. SEO Related keys (optional): get these keys from search engine consoles (e.g. Google, Bing and Baidu) and paste here.
   6. `author`: the author information of this homepage, including some other websites, emails, city and univeristy.
   7. More configuration details are described in the comments.
5. Add your homepage content in `_pages/about.md`.
   1. You can use html+markdown syntax just same as jekyll.
   2. You can use a `<span>` tag with class `show_paper_citations` and attribute `data` to display the citations of your paper. Set the data to the google scholar paper ID. For

      ```html
      <span class='show_paper_citations' data='DhtAFkwAAAAJ:ALROH1vI_8AC'></span>
      ```

      > Q: How to get the google scholar paper ID?
      > A: Enter your google scholar homepage and click the paper name. Then you can see the paper ID from `citation_for_view=XXXX`, where `XXXX` is the required paper ID.
      >
6. Your page will be published at `https://USERNAME.github.io`.

## Debug Locally

1. Clone your REPO to local using `git clone`.
2. Install Jekyll building environment, including `Ruby`, `RubyGems`, `GCC` and `Make` following [the installation guide](https://jekyllrb.com/docs/installation/#requirements).
3. Run `bash run_server.sh` to start Jekyll livereload server.
4. Open http://127.0.0.1:4000 in your browser.
5. If you change the source code of the website, the livereload server will automatically refresh.
6. When you finish the modification of your homepage, `commit` your changings and `push` to your remote REPO using `git` command.

# Acknowledges

We appreciate the following GitHub repos a lot for their valuable code and efforts.

- AcadHomepage incorporates Font Awesome, which is distributed under the terms of the SIL OFL 1.1 and MIT License.
- AcadHomepage is influenced by the github repo [mmistakes/minimal-mistakes](https://github.com/mmistakes/minimal-mistakes), which is distributed under the MIT License.
- AcadHomepage is influenced by the github repo [academicpages/academicpages.github.io](https://github.com/academicpages/academicpages.github.io), which is distributed under the MIT License.
- AcadHomepage is influenced by the github repo [acad-homepage.github.io](https://github.com/RayeRen/acad-homepage.github.io), which is distributed under the MIT License.
- AcadHomepage is influenced by the github repo [rayeren.github.io](https://github.com/RayeRen/rayeren.github.io), which is distributed under the MIT License.
