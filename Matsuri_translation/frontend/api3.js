//twemoji.base = "https://raw.githubusercontent.com/twitter/twemoji/master/assets/";
let url;
let saveUrlUser = false;
let isSubmittedFast;
function submit_task(isFast) {
    performanceData.beforeSubmitTask = new Date().getTime();
    isSubmittedFast = isFast;
    url = $('#url').val();
    dataLayer.push({"event": "taskSubmit", "tweetUrl": url});
    url = url.replace("mobile.twitter.com", "twitter.com");
    url = url.replace(/\?.*/, "");
    $("#url").val(url);
    //let translation = $('#translation').val().replace(/\r\n|\r|\n/g, '\\r');
    $('#progress').val("开始获取图像");
    $("#autoprogress").text("开始获取图像");
    $('#url').css("display", "none");
    $('#progress').css("display", "");
    $('#button-submit').attr("disabled", "disabled");
    $('#button-submit-fast').attr("disabled", "disabled");
    $("#translatetbody").html("");
    $("#screenshots").html("        <div id=\"screenshotclip0\" class=\"screenshotclip\"\n" +
        "             style=\"height: 800px;background-image: url('img/twittersample.jpg')\"></div>");
    let jqxhr = $.ajax({
        url: "/api/tasks",
        type: "post",
        data: JSON.stringify({
            "url": url,
            "fast": isFast || false
        }),
        contentType: "application/json; charset=utf-8",
        dataType: "json",
    }).done(function (data) {
        fetch_img(data.task_id)
    })
}

function fetch_img(task_id) {
    performanceData.beforeFetchImg = new Date().getTime();
    let count = 0;
    let locked = false;
    let event = setInterval(function () {
        if (locked) return;
        locked = true;
        count += 1;

        let jqxhr = $.ajax({
            url: '/api/get_task=' + task_id,
            success: function (data, status, xhr) {
                locked = false;
                if (data.state === "SUCCESS") {
                    performanceData.getTaskSucccess = new Date().getTime();
                    let filename = data.result.substr(0, data.result.indexOf("|"));
                    let clipinfo = data.result.substr(data.result.indexOf("|") + 1);
                    clipinfo = JSON.parse(clipinfo);
                    show_translate(clipinfo);
                    refresh_trans_div();


                    let xhr = new XMLHttpRequest();
                    xhr.open('GET', 'cache/' + filename + '.png');
                    xhr.onprogress = function (event) {
                        if (event.lengthComputable) {
                            $('#progress').val("正在下载图片 (" + Math.round((event.loaded / event.total) * 100) + "%)");

                            $("#autoprogress").text("正在下载图片 (" + Math.round((event.loaded / event.total) * 100) + "%)");
                        }
                    };

                    xhr.onload = function (e) {
                        if (saveUrlUser) if ($("#url").val().split("/")[3] != null) localStorage.setItem("lastUser", $("#url").val().split("/")[3]);
                        saveUrlUser = false;
                        performanceData.imageLoaded = new Date().getTime();
                        $("#screenshots").html("            <div id=\"screenshotclip0\" class=\"screenshotclip\"\n" +
                            "             style=\"height: 800px;background-image: url('img/twittersample.jpg')\"></div>");
                        $("#screenshotclip0").css("background-image", 'url("cache/' + filename + '.png")');

                        $('#url').css("display", "");
                        $('#progress').css("display", "none");

                        $('#button-submit').removeAttr("disabled");
                        $('#button-submit-fast').removeAttr("disabled");
                        clip_screenshot();
                        let translateTarget = 0;
                        for (let i = 0; i < clipinfo.length; i++) {
                            if (clipinfo[i].textSize === 23) {
                                translateTarget = clipinfo[i].articleId;
                                break;
                            }
                        }
                        let i = 0;
                        for (let i = 0; i < clipinfo.length && clipinfo[i].articleId <= translateTarget; ++i) {
                            if (!$("#show" + i).is(':checked')) {
                                $("#show" + i).prop('checked', true).change();
                            }
                        }
                        if (defaultTranslate != null) {
                            let multiTranslateIndex = defaultTranslate.trim().match(/^##[0-9]+$/gm);
                            if (multiTranslateIndex != null) {
                                multiTranslateIndex = multiTranslateIndex.map(s => +s.substr(2) - 1);
                                let multiTranslation = defaultTranslate.trim().split(/\n?^##[0-9]+$\n?/gm).slice(1);
                                for (let i = 0; i < multiTranslateIndex.length; i++) {
                                    if (!$("#show" + multiTranslateIndex[i]).is(':checked')) {
                                        $("#show" + i).prop('checked', true).change();
                                    }
                                    $("#transtxt" + multiTranslateIndex[i]).val(multiTranslation[i]);
                                    if (multiTranslateIndex[i] != translateTarget) {
                                        templatechosen[multiTranslateIndex[i]] = 1;
                                    }
                                }
                            } else {
                                $("#transtxt" + translateTarget).val(defaultTranslate);
                            }
                        }
                        refresh_trans_div();
                        if (defaultTranslate != null || getUrlParam("out") != null) {
                            downloadAsCanvas();
                            if (getUrlParam("out") == null) {
                                $("#autoprogress").text("正在保存");
                                setTimeout(function () {
                                    $("#autoprogress").text("结束");
                                }, 1000);

                                setTimeout(function () {
                                    window.location.href = "/";
                                }, 3000)
                            }
                        }
                    };
                    xhr.send();


                    clearInterval(event);
                }
            },
            error: function (xhr, info, e) {
                console.error(info);
                alert("服务器错误，请检查您提供的地址是否为正确的推特地址");
                $('#url').css("display", "");
                $('#progress').css("display", "none");

                $('#button-submit').removeAttr("disabled");
                $('#button-submit-fast').removeAttr("disabled");
            },
            dataType: 'json',
        });
        $('#progress').val("等待服务器响应，已尝试" + count + "次");
        $("#autoprogress").text("等待服务器响应，已尝试" + count + "次");
    }, 1000)
}

let tweetpos;
let articleToIndex = {};
let templatechosen = [];
let defaultTranslate;

function show_translate(data) {
    tweetpos = data;
    templatechosen = [];
    $("#translatetbody").html("");
    for (let i = 0; i < tweetpos.length; ++i) {
        if (!articleToIndex.hasOwnProperty(tweetpos[i].articleId)) {
            articleToIndex[tweetpos[i].articleId] = [];
        }
        articleToIndex[tweetpos[i].articleId].push(i);
        templatechosen.push('');
        let str = tweetpos[i].text || "";
        let rows = (str.match(/\n/g) || []).length + 2;  // default rows of the translation textarea
        str = str.replace(/\n/g, "<br>");
        str = str.replace(/  /g, "&nbsp; ");
        $("#translatetbody").append("<tr id=\'translatetr" + i + "\'>\n" +
            "      <th scope=\"row\">" +
            "<input type=\'checkbox\' " + (i == 0 ? "checked" : "") + " id=\'show" + i + "\'>" +
            "</th>\n" +
            "      <td class=\'originaltext\'>" + str + "</td>\n" +
            "    <td><div class=\'translatetd\' id=\'translatetd" + i + "\' " + (i > 0 ? "style='display:none'" : "") + " ><div class=\'input-group\'>" +
            "<textarea id=\'transtxt" + i + "\' class=\'form-control\' " + (i == 0 ? "style='height:100px'" : "") + " rows=\'" + rows + "\'></textarea></div>\n" +
            "      <div class=\"dropdown templatedropdown\">\n" +
            "  <button class=\"btn btn-outline-secondary w-100 dropdown-toggle\" type=\"button\" id=\"dropdownMenu" + i + "\" data-toggle=\"dropdown\" aria-haspopup=\"true\" aria-expanded=\"false\">\n    模板选择\n  </button>\n  <div class=\"dropdown-menu dropdownmenuitems\" aria-labelledby=\"dropdownMenu" + i + "\" id=\"dropdownmenuitems" + i + "\">\n  </div>\n</div>\n      " +
            "</div></td>\n" +
            "    </tr>");

        $("#transtxt" + i).focus(function () {
            $("#screenshotclip" + $("tbody textarea").index(this))[0].scrollIntoView();
        });
        $("#transtxt" + i).keyup(function () {
            refresh_trans_div();
            $("#screenshotclip" + $("tbody textarea").index(this))[0].scrollIntoView();

        });
        $("#transtxt" + i).change(function () {
            refresh_trans_div();
            $("#screenshotclip" + $("tbody textarea").index(this))[0].scrollIntoView();

        });
        $("#show" + i).change(function () {
            syncArticleVisibility(tweetpos[i].articleId, $(this).is(':checked'));
            refresh_trans_div();
            $("#screenshotclip" + $("tbody input").index(this))[0].scrollIntoView();

        });

        if (str.length === 0 && tweetpos[i].textSize === 0) {
            $('#translatetr' + i).hide();
        }
    }
    $(".originaltext").click(function () {
        if (document.getSelection().type != "Range" && window.getSelection().type != "Range")
            $("#show" + $(".originaltext").index(this)).click();
    })
}

function syncArticleVisibility(articleId, isChecked) {
    let ids = articleToIndex[articleId];
    for (let i = 0; i < ids.length; ++i) {
        let $ele = $("#show" + ids[i]);
        if ($ele.is(':checked') !== isChecked) {
            $ele.prop('checked', isChecked).change();
        }
    }
}

function toggleLikes(obj) {
    if ($(obj).hasClass("nolikes")) {
        $(obj).css("height", $(obj).height() + 55);
        $(obj).removeClass("nolikes");
        return true;
    } else {
        $(obj).css("height", $(obj).height() - 55);
        $(obj).addClass("nolikes");
        return false;
    }
}

function clip_screenshot() {
    let $clip0 = $('#screenshotclip0')
    let width = $clip0.css('width');
    let bg = $clip0.css('background-image')
    let $clip;
    for (let i = 0; i < tweetpos.length; ++i) {
        $clip = $('#screenshotclip' + i);
        $clip.css('height', tweetpos[i].bottom - (i === 0 ? 0 : tweetpos[i - 1].bottom));
        $clip.css('display', 'none');
        $clip.click(function () {
            goto($(this)[0].id);
        });
        if (i > 0) {
            $clip.css('background-image', bg);
            $clip.css('width', width);
            $clip.css('background-position-y', -tweetpos[i - 1].bottom);
        }
        if (i + 1 < tweetpos.length) {
            $clip.after('<div class="screenshotclip" id="' + 'screenshotclip' + (i + 1) + '"></div>');
        }

        if (tweetpos[i].textSize === 23) {
            let ids = articleToIndex[tweetpos[i].articleId];
            let index = ids[ids.length - 1];
            let $target = $('#screenshotclip' + index);
            if (localStorage.getItem('isLikeShown') !== null && (!JSON.parse(localStorage.getItem('isLikeShown')))) {
                toggleLikes($target[0]);
            } else if (getUrlParam('noLikes') != null) {
                toggleLikes($target[0]);
            }
            $target.click(function () {
                localStorage.setItem('isLikeShown', JSON.stringify(toggleLikes(this)));
            });
        }
        else {
            $clip.click(function () {
                goto($(this)[0].id);
            });
        }

        $clip.after('<div class="screenshotclip" id="' + 'translatediv' + i + '"></div>');

        $('#translatediv' + i).click(function () {
            goto($(this)[0].id);
        });
    }
}

let gotoDoubleClick = "";
let gotoDoubleClickTimeout = -1;
function goto(id) {
    if (gotoDoubleClick != id) {
        clearTimeout(gotoDoubleClickTimeout);
        gotoDoubleClick = id;
        gotoDoubleClickTimeout = setTimeout(() => {
            gotoDoubleClick = "";
        }, 300);
        return;
    }
    id = id.replace(/[^0-9]/g, "");
    id = parseInt(id);
}

function refresh_trans_div() {
    let template = $("#translatetemp").val();
    if (template != "") localStorage.setItem("translatetemp", template);
    let isMultiMode = true;
    let templates = [];
    let names = template.match(/<!--.*-->/g);
    let contents = template.split(/<!--.*-->/g);
    try {
        for (let i = 0; i < names.length; i++) {
            names[i] = names[i].replace("<!--", "").replace("-->", "");
        }
        for (let i = 0; i < names.length / 2; i++) {
            if (names[i * 2] == names[i * 2 + 1]) {
                templates.push({
                    name: names[i * 2], content: contents[i * 2 + 1]
                })
            } else {
                throw null;
            }
        }
    } catch (e) {
        isMultiMode = false;
        templates = [{name: "", content: template}];
    }

    if (isMultiMode) $('.translatetd').addClass("multi"); else $('.translatetd').removeClass("multi");
    $('.dropdownmenuitems').html("");
    for (let i = 0; i < templates.length; i++) {
        $('.dropdownmenuitems').append('<button class="dropdown-item templatebutton" type="button">' + templates[i].name + '</button>')
    }
    $('.templatebutton').click(function () {
        let i = $('.dropdownmenuitems').index($(this).parent());
        templatechosen[i] = $(this).text().trim();
        $("#translatediv" + i)[0].scrollIntoView();
        refresh_trans_div();
    });
    for (let i = 0; i < tweetpos.length; i++) {
        if ($("#show" + i).is(':checked')) {
            $("#screenshotclip" + i).show();
            $("#translatediv" + i).show();
            $("#translatetd" + i).show();
        } else {
            $("#screenshotclip" + i).hide();
            $("#translatediv" + i).hide();
            $("#translatetd" + i).hide();
        }
        $("#translatediv" + i).html("");
        if ($("#transtxt" + i).val() !== "") {
            let transtxt = $("#transtxt" + i).val();


            transtxt = transtxt.replace(/https?:\/\/([^ \n]+)/g, function (word) {
                return "<span class='link'>" + (
                    word.replace(/https?:\/\//g, "").length > 25 ? (word.replace(/https?:\/\//g, "").substr(0, 25) + "...") : (word.replace(/https?:\/\//g, ""))
                ) + "</span>"
            })
                .replace(/(^@[^ \n]+|\n@[^ \n]+| @[^ \n]+|^#[^ \n]*[^1234567890 \n][^ \n]*|\n#[^ \n]*[^1234567890 \n][^ \n]*| #[^ \n]*[^1234567890 \n][^ \n]*)/g, "<span class='link'>$1</span>")
                .replace(/\n/g, "<br>")
                .replace(/  /g, "&nbsp; ");
            let templateusing = template;
            if (isMultiMode) {
                templateusing = templates[0].content;

                if (typeof templatechosen[i] === 'number') templateusing = templates[templatechosen[i]].content;
                else
                    for (let j = 0; j < templates.length; j++)
                        if (templates[j].name == templatechosen[i]) templateusing = templates[j].content;
            }
            $("#translatediv" + i).html(twemoji.parse(templateusing.replace("{T}", transtxt)));
        }
    }
    // $("#screenshots img.emoji").each(function(i,obj){
    //     $(obj).replaceWith("<div class='emoji' style='background-image: url(\""+$(obj).attr("src")+"\")'></div>")
    // })


}

function getUrlParam(k) {
    let regExp = new RegExp('([?]|&)' + k + '=([^&]*)(&|$)');
    let result = window.location.href.match(regExp);
    if (result) {
        return decodeURIComponent(result[2]);
    } else {
        return null;
    }
}

function loadJS(url, callback) {
    let script = document.createElement('script'),
        fn = callback || function () {
        };
    script.type = 'text/javascript';
    if (script.readyState) {
        script.onreadystatechange = function () {
            if (script.readyState == 'loaded' || script.readyState == 'complete') {
                script.onreadystatechange = null;
                fn();
            }
        }
    } else {
        script.onload = function () {
            fn();
        };
    }
    script.src = url;
    document.getElementsByTagName('head')[0].appendChild(script);
}

if (getUrlParam('debug'))
    loadJS("https://cdn.bootcdn.net/ajax/libs/vConsole/3.3.4/vconsole.min.js", () => {
        new VConsole();
    });
$(function () {
    if (getUrlParam("template") != null && getUrlParam("template").length > 0 && getUrlParam("out") == null) {
        $.get(getUrlParam("template"), function (data, status) {
            if (confirm("将要用链接的内容替代现有的翻译模板，确认覆盖？")) localStorage.setItem("translatetemp", data);
            window.location.href = "/";
        });
    }
    $("#btnToggleTemplate").click(function () {
        if ($("#translatetemp").css("display") == "none") $("#translatetemp").show(); else $("#translatetemp").hide();
    });
    $('#button-submit').click(function () {
        saveUrlUser = true;
        submit_task();
    });
    $('#button-submit-fast').click(function () {
        saveUrlUser = true;
        submit_task(true);
    });
    if (localStorage.getItem("translatetemp") == null) localStorage.setItem("translatetemp", '<div style="margin:10px 38px">\n' +
        '<img src="img/nana_text.png" height="34">\n' +
        '<div style="font-size:20px;font-family: source-han-sans-simplified-c, sans-serif;font-weight: 400;font-style: normal;">{T}</div>\n' +
        '</div>')
    $("#translatetemp").val(localStorage.getItem("translatetemp"));
    $("#translatetemp").keyup(refresh_trans_div);
    $(".screenshotwrapper").on("touchstart", function () {
        $("body").addClass("overview");
    });
    $(".settingswrapper").on("touchstart", function () {
        $("body").removeClass("overview");
    });

    if (localStorage.getItem("lastUser") != null) $("#url").val("https://twitter.com/" + localStorage.getItem("lastUser"));
    $("#url").keypress(function (event) {
        if (event.keyCode == 13) {
            submit_task(true);
        }
    });


    if (getUrlParam("tweet") != null && getUrlParam("tweet").length > 0) {
        performanceData.autoBeforeTemplate = new Date().getTime();
        $.ajaxSettings.async = false;
        if (getUrlParam("template") != null && getUrlParam("template").length > 0) {
            $.get(getUrlParam("template"), function (data, status) {
                localStorage.setItem("translatetemp", data);
                $("#translatetemp").val(localStorage.getItem("translatetemp"));
            });
        }
        $.ajaxSettings.async = true;
        performanceData.autoAfterTemplate = new Date().getTime();
        $('#url').val(getUrlParam("tweet"));

        if (getUrlParam("translate") != null && getUrlParam("translate").length > 0) {
            defaultTranslate = getUrlParam("translate");

            defaultTranslate = defaultTranslate.replace(/\\n/g, "\n");

            $(".settingscontainer").hide();
            $(".autobanner").show();
        } else if (getUrlParam("out") != null) {
            $(".settingscontainer").hide();
            $(".autobanner").show();
        }
        if (defaultTranslate && defaultTranslate.trim().match(/^##[0-9]+$/gm) != null) submit_task(false);
        else submit_task(true);
    }


});

function downloadAsCanvas() {
    $('body')[0].scrollIntoView();
    dataLayer.push({"event": "downloadPNG", "tweetUrl": url});
    performanceData.beforeH2C = new Date().getTime();
    html2canvas(document.querySelector("#screenshots"), {useCORS: true}).then(canvas => {
        performanceData.afterH2C = new Date().getTime();
        //createAndDownloadFile("twitterImg" + new Date().getTime() + ".png", canvas.toDataURL("image/png"));
        if (getUrlParam("out") == null) {
            canvas.toBlob(function (blob) {
                saveAs(blob, "twitterImg" + new Date().getTime() + ".png");

            });
        } else {
            $("body>*").hide();
            $("body").prepend(canvas);
        }
    });
}
