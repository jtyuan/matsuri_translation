from datetime import datetime
from os import mkdir
from os.path import isdir
import time
import json
from retrying import retry

from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By

from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


class TweetProcess:
    def __init__(self, driver):
        self.driver = driver
        self.afterHeadlessInstance = int(round(time.time() * 1000))
        self.beforeOpenPage = 0
        self.afterOpenPage = 0

    def open_page(self, url):
        self.beforeOpenPage = int(round(time.time() * 1000))
        self.driver.get(url)
        WebDriverWait(self.driver, 60, 0.1).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'article')))
        self.afterOpenPage = int(round(time.time() * 1000))

    @retry
    def scroll_page_to_tweet(self, fast):
        self.driver.set_window_size(640, self.driver.execute_script('''
        return document.querySelector("section").getBoundingClientRect().bottom
        '''))
        # self.driver.execute_script("$('body')[0].scrollIntoView()")

    def save_screenshots(self, fast):
        filename = str(int(round(time.time() * 1000)))
        if not isdir('Matsuri_translation/frontend/cache'):
            mkdir('Matsuri_translation/frontend/cache')

        self.driver.save_screenshot(
            f'Matsuri_translation/frontend/cache/{filename}.png')

        clipinfo = self.driver.execute_script('''
            let ls=[];
            try{
                let clipText = [...document.querySelectorAll('article>div>div>div>div>div>div>div[dir=auto][lang]'),
                    ...document.querySelectorAll('article div[data-testid=tweet]>div>div>div>div[dir=auto]')]
                    .sort((a, b) => a.getBoundingClientRect().bottom - b.getBoundingClientRect().bottom);
                let clipArticle=[...document.querySelectorAll('article')];
                ls = clipArticle.map(article => {
                    let containingDiv = article.parentElement.parentElement.parentElement;
                    let rect = containingDiv.getBoundingClientRect();
                    let text = clipText.reduce((p, c) => (
                        // Find the last text element that's inside the article. reduce is unnecessary.
                        // Consider replace it with simple backward for-loop.
                        c.getBoundingClientRect().top >= rect.top && c.getBoundingClientRect().bottom < rect.bottom ? c : p
                    ), null);
                    if (text) {
                        text.querySelectorAll("img").forEach(o => { o.parentNode.innerHTML = o.alt });
                        return {
                            blockbottom: rect.bottom,
                            bottom: text.getBoundingClientRect().bottom,
                            text: [...text.querySelectorAll("span")].reduce((p, c) => p + c.innerText, ''),
                            textSize: window.getComputedStyle(text).fontSize.replace('px',''),
                        }
                    } else {
                        // Tweet without text (pure media: image, video, etc.)
                        return {
                            blockbottom: rect.bottom,
                            bottom: rect.bottom,
                            text: '',
                            textSize: 0,
                        }
                    }
                })
            } catch {}
            return JSON.stringify(ls);
        ''')
        return filename + "|" + clipinfo

    def save_screenshots_auto(self, eventStartTime):
        filename = str(int(round(time.time() * 1000))) + "a"
        if not isdir('Matsuri_translation/frontend/cache'):
            mkdir('Matsuri_translation/frontend/cache')

        self.driver.set_window_size(self.driver.execute_script('''
                
                    return $("canvas").first().height()==null?1920:640;
                    '''), self.driver.execute_script('''
                
                    return $("canvas").first().height()==null?2000:$("canvas").first().height();
                    '''))
        # print(self.driver.find_element_by_css_selector('iframe').get_attribute('innerHTML'))
        self.driver.save_screenshot(
            f'Matsuri_translation/frontend/cache/{filename}.png')
        # pngquant.quant_image(f'Matsuri_translation/frontend/cache/{filename}.png',f'Matsuri_translation/frontend/cache/{filename}o.png')
        return filename

    def modify_tweet(self):
        while self.driver.execute_script(
                '''
                let top=0;
                try{
                    top = document.body.parentElement.scrollTop;
                    document.body.scrollIntoView();
                }catch{}
                return top;
                '''
        ) > 0:
            time.sleep(0.5)
        self.driver.execute_script('''
            try {
                new_element = document.createElement("style");
                new_element.innerHTML = ("*{transition:none !important;}");
                document.body.appendChild(new_element);
                document.body.style.overflow = "hidden";
                document.body.scrollIntoView();
                document.querySelectorAll("article div[role=button] div[dir=auto]").forEach(o=>o.click());
                document.querySelector("div[data-testid=primaryColumn]").style.maxWidth="640px";
                document.querySelector("div[data-testid=primaryColumn]").style.border="0";
                document.querySelectorAll("article div[role=group]").forEach(o=>o.remove());
                function shakeTree(node){
                    for (let e of node.parentElement.children){if(e!==node)e.remove()};
                    if(node.id!=="react-root")shakeTree(node.parentElement);
                }
                shakeTree(document.querySelector('section[aria-labelledby=accessible-list-0]'));
                document.body.scrollIntoView();
            } catch {}
        ''')
        # Wait for the above script to take effect
        time.sleep(1)
        primary_column = self.driver.find_element("xpath", '//div[@data-testid="primaryColumn"]')
        self.driver.set_window_size(640, primary_column.size['height'])

        # Wait for the above script to take effect
        time.sleep(1)
        self.driver.execute_script('''
            try {
                document.body.scrollIntoView();
            } catch {}
        ''')

        time.sleep(1)
