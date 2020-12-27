tweetToaster = function () {
  let url
  let saveUrlUser = false
  let isSubmittedFast

  function submit_task(isFast) {
    performanceData.beforeSubmitTask = new Date().getTime()
    isSubmittedFast = isFast
    let $url = $('#url')
    url = $url.val()
    dataLayer.push({ 'event': 'taskSubmit', 'tweetUrl': url })
    url = url.replace('mobile.twitter.com', 'twitter.com')
    url = url.replace(/\?.*/, '')
    $url.val(url)
    let $progress = $('#progress')
    $progress.val('开始获取图像')
    $('#auto-progress').text('开始获取图像')
    $url.css('display', 'none')
    $progress.css('display', '')
    $('#button-submit').attr('disabled', 'disabled')
    $('#button-submit-fast').attr('disabled', 'disabled')
    $('#translate-body').html('')
    $('#screenshots').html(`
        <div id="screenshot-clip0" class="screenshot-clip"
             style="height: 800px;background-image: url('img/twittersample.jpg')">
        </div>
`)
    $.ajax({
      url: '/api/tasks',
      type: 'post',
      data: JSON.stringify({
        'url': url,
        'fast': isFast || false
      }),
      contentType: 'application/json; charset=utf-8',
      dataType: 'json',
    }).done(function (data) {
      fetch_img(data.task_id)
    })
  }

  function fetch_img(task_id) {
    performanceData.beforeFetchImg = new Date().getTime()
    let count = 0
    let locked = false
    let $url = $('#url')
    let $progress = $('#progress')
    let $autoProgress = $('#auto-progress')
    let event = setInterval(function () {
      if (locked) return
      locked = true
      count += 1

      $.ajax({
        url: '/api/get_task=' + task_id,
        success: function (data) {
          locked = false
          if (data.state === 'SUCCESS') {
            performanceData.getTaskSucccess = new Date().getTime()
            let filename = data.result.substr(0, data.result.indexOf('|'))
            let clipInfo = data.result.substr(data.result.indexOf('|') + 1)
            clipInfo = JSON.parse(clipInfo)
            show_translate(clipInfo)
            refresh_trans_div()


            let xhr = new XMLHttpRequest()
            xhr.open('GET', 'cache/' + filename + '.png')
            xhr.onprogress = function (event) {
              if (event.lengthComputable) {
                $progress.val('正在下载图片 (' + Math.round((event.loaded / event.total) * 100) + '%)')

                $autoProgress.text('正在下载图片 (' + Math.round((event.loaded / event.total) * 100) + '%)')
              }
            }

            xhr.onload = function () {
              if (saveUrlUser) if ($url.val().split('/')[3] != null) localStorage.setItem('lastUser', $url.val().split('/')[3])
              saveUrlUser = false
              performanceData.imageLoaded = new Date().getTime()
              $('#screenshots').html(`
            <div id="screenshot-clip0" class="screenshot-clip"
                 style="height: 800px;background-image: url('img/twittersample.jpg')"></div>
`)
              $('#screenshot-clip0').css('background-image', 'url("cache/' + filename + '.png")')

              $url.css('display', '')
              $progress.css('display', 'none')

              $('#button-submit').removeAttr('disabled')
              $('#button-submit-fast').removeAttr('disabled')
              clip_screenshot()
              let translateTarget = 0
              for (let i = 0; i < clipInfo.length; i++) {
                if (clipInfo[i].textSize === 23) {
                  translateTarget = clipInfo[i].articleId
                  break
                }
              }
              for (let i = 0; i < clipInfo.length && clipInfo[i].articleId <= translateTarget; ++i) {
                let $show = $('#show' + i)
                if (!$show.is(':checked')) {
                  $show.prop('checked', true).trigger('change')
                }
              }
              if (defaultTranslate != null) {
                let multiTranslateIndex = defaultTranslate.trim().match(/^##[0-9]+$/gm)
                if (multiTranslateIndex != null) {
                  multiTranslateIndex = multiTranslateIndex.map(s => +s.substr(2) - 1)
                  let multiTranslation = defaultTranslate.trim().split(/\n?^##[0-9]+$\n?/gm).slice(1)
                  for (let i = 0; i < multiTranslateIndex.length; i++) {
                    if (!$('#show' + multiTranslateIndex[i]).is(':checked')) {
                      $('#show' + i).prop('checked', true).trigger('change')
                    }
                    $('#trans-text' + multiTranslateIndex[i]).val(multiTranslation[i])
                    if (multiTranslateIndex[i] != translateTarget) {
                      templateChosen[multiTranslateIndex[i]] = 1
                    }
                  }
                } else {
                  $('#trans-text' + translateTarget).val(defaultTranslate)
                }
              }
              refresh_trans_div()
              if (defaultTranslate != null || getUrlParam('out') != null) {
                downloadAsCanvas()
                if (getUrlParam('out') == null) {
                  $autoProgress.text('正在保存')
                  setTimeout(function () {
                    $autoProgress.text('结束')
                  }, 1000)

                  setTimeout(function () {
                    window.location.href = '/'
                  }, 3000)
                }
              }
            }
            xhr.send()

            clearInterval(event)
          }
        },
        error: function (xhr, info, e) {
          console.error(info)
          alert('服务器错误，请检查您提供的地址是否为正确的推特地址')
          $url.css('display', '')
          $progress.css('display', 'none')

          $('#button-submit').removeAttr('disabled')
          $('#button-submit-fast').removeAttr('disabled')
        },
        dataType: 'json',
      })
      $progress.val('等待服务器响应，已尝试' + count + '次')
      $autoProgress.text('等待服务器响应，已尝试' + count + '次')
    }, 1000)
  }

  let tweetParts
  let articleToIndex = {}
  let templateChosen = []
  let defaultTranslate

  function show_translate(data) {
    tweetParts = data
    templateChosen = []
    let $translateBody = $('#translate-body')
    $translateBody.html('')
    for (let i = 0; i < tweetParts.length; ++i) {
      if (!articleToIndex.hasOwnProperty(tweetParts[i].articleId)) {
        articleToIndex[tweetParts[i].articleId] = []
      }
      articleToIndex[tweetParts[i].articleId].push(i)
      templateChosen.push('')
      let str = tweetParts[i].text || ''
      let rows = (str.match(/\n/g) || []).length + 2  // default rows of the translation textarea
      str = str.replace(/\n/g, '<br>')
      str = str.replace(/  /g, '&nbsp; ')
      $translateBody.append(`
            <tr id="translate-tr${i}">
                <th scope="row"><input type="checkbox" ${i === 0 ? 'checked' : ''} id="show${i}"></th>
                <td class="original-text">${str}</td>
                <td>
                <div class="translate-td" id="translate-td${i}" ${i > 0 ? 'style="display:none"' : ''} >
                  <div class="input-group">
                    <textarea id="trans-text${i}" class="form-control" ${i === 0 ? 'style="height:100px"' : ''} rows="${rows}"></textarea>
                  </div>
                  <div class="dropdown template-dropdown">
                    <button class="btn btn-outline-secondary w-100 dropdown-toggle" type="button"
                            id="dropdown-menu${i}" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                      模板选择
                    </button>
                    <div class="dropdown-menu dropdown-menu-items" aria-labelledby="dropdown-menu${i}" id="dropdown-menu-items${i}"></div>
                  </div>
                </div>
              </td>
            </tr>
`)

      let $translatedText = $('#trans-text' + i)

      $translatedText.on('focus', function () {
        $('#screenshot-clip' + $('tbody textarea').index(this))[0].scrollIntoView()
      })
      $translatedText.on('keyup', function () {
        refresh_trans_div()
        $('#screenshot-clip' + $('tbody textarea').index(this))[0].scrollIntoView()

      })
      $translatedText.on('change', function () {
        refresh_trans_div()
        $('#screenshot-clip' + $('tbody textarea').index(this))[0].scrollIntoView()

      })
      $('#show' + i).on('change', function () {
        syncArticleVisibility(tweetParts[i].articleId, $(this).is(':checked'))
        refresh_trans_div()
        $('#screenshot-clip' + $('tbody input').index(this))[0].scrollIntoView()

      })

      if (str.length === 0 && tweetParts[i].textSize === 0) {
        $('#translate-tr' + i).hide()
      }
    }
    $('.original-text').on('click', function () {
      if (document.getSelection().type !== 'Range' && window.getSelection().type !== 'Range')
        $('#show' + $('.original-text').index(this)).trigger('click')
    })
  }

  function syncArticleVisibility(articleId, isChecked) {
    let ids = articleToIndex[articleId]
    for (let i = 0; i < ids.length; ++i) {
      let $ele = $('#show' + ids[i])
      if ($ele.is(':checked') !== isChecked) {
        $ele.prop('checked', isChecked).trigger('change')
      }
    }
  }

  function toggleLikes(obj) {
    if ($(obj).hasClass('nolikes')) {
      $(obj).css('height', $(obj).height() + 55)
      $(obj).removeClass('nolikes')
      return true
    } else {
      $(obj).css('height', $(obj).height() - 55)
      $(obj).addClass('nolikes')
      return false
    }
  }

  function clip_screenshot() {
    let $clip0 = $('#screenshot-clip0')
    let width = $clip0.css('width')
    let bg = $clip0.css('background-image')
    let $clip
    for (let i = 0; i < tweetParts.length; ++i) {
      $clip = $('#screenshot-clip' + i)
      $clip.css('height', tweetParts[i].bottom - (i === 0 ? 0 : tweetParts[i - 1].bottom))
      $clip.css('display', 'none')
      $clip.on('click', function () {
        goto($(this)[0].id)
      })
      if (i > 0) {
        $clip.css('background-image', bg)
        $clip.css('width', width)
        $clip.css('background-position-y', -tweetParts[i - 1].bottom)
      }
      if (i + 1 < tweetParts.length) {
        $clip.after('<div class="screenshot-clip" id="' + 'screenshot-clip' + (i + 1) + '"></div>')
      }

      if (tweetParts[i].textSize === 23) {
        let ids = articleToIndex[tweetParts[i].articleId]
        let index = ids[ids.length - 1]
        let $target = $('#screenshot-clip' + index)
        if (localStorage.getItem('isLikeShown') !== null && (!JSON.parse(localStorage.getItem('isLikeShown')))) {
          toggleLikes($target[0])
        } else if (getUrlParam('noLikes') != null) {
          toggleLikes($target[0])
        }
        $target.on('click', function () {
          localStorage.setItem('isLikeShown', JSON.stringify(toggleLikes(this)))
        })
      } else {
        $clip.on('click', function () {
          goto($(this)[0].id)
        })
      }

      $clip.after('<div class="screenshot-clip" id="' + 'translate-div' + i + '"></div>')

      $('#translate-div' + i).on('click', function () {
        goto($(this)[0].id)
      })
    }
  }

  let gotoDoubleClick = ''
  let gotoDoubleClickTimeout = -1

  function goto(id) {
    if (gotoDoubleClick !== id) {
      clearTimeout(gotoDoubleClickTimeout)
      gotoDoubleClick = id
      gotoDoubleClickTimeout = setTimeout(() => {
        gotoDoubleClick = ''
      }, 300)
      return
    }
    id = id.replace(/[^0-9]/g, '')
    id = parseInt(id)
  }

  function refresh_trans_div() {
    let template = $('#translate-temp').val()
    if (template !== '') localStorage.setItem('translate-temp', template)
    let isMultiMode = true
    let templates = []
    let names = template.match(/<!--.*-->/g)
    let contents = template.split(/<!--.*-->/g)

    if (names) {
      for (let i = 0; i < names.length; i++) {
        names[i] = names[i].replace('<!--', '').replace('-->', '')
      }
      for (let i = 0; i < names.length / 2; i++) {
        if (names[i * 2] === names[i * 2 + 1]) {
          templates.push({
            name: names[i * 2], content: contents[i * 2 + 1]
          })
        } else {
          isMultiMode = false
          break
        }
      }
    } else {
      isMultiMode = false
    }

    if (isMultiMode) {
      $('.translate-td').addClass('multi')
    } else {
      templates = [{ name: '', content: template }]
      $('.translate-td').removeClass('multi')
    }
    let $dropDownMenuItems = $('.dropdown-menu-items')
    $dropDownMenuItems.html('')
    for (let i = 0; i < templates.length; i++) {
      $dropDownMenuItems.append('<button class="dropdown-item template-button" type="button">' + templates[i].name + '</button>')
    }
    $('.template-button').on('click', function () {
      let i = $dropDownMenuItems.index($(this).parent())
      templateChosen[i] = $(this).text().trim()
      $('#translate-div' + i)[0].scrollIntoView()
      refresh_trans_div()
    })
    for (let i = 0; i < tweetParts.length; i++) {
      let $translateDiv = $('#translate-div' + i)
      if ($('#show' + i).is(':checked')) {
        $('#screenshot-clip' + i).show()
        $translateDiv.show()
        $('#translate-td' + i).show()
      } else {
        $('#screenshot-clip' + i).hide()
        $translateDiv.hide()
        $('#translate-td' + i).hide()
      }
      let $translatedText = $('#trans-text' + i)
      $translateDiv.html('')
      if ($translatedText.val() !== '') {
        let translatedText = $translatedText.val()


        translatedText = translatedText.replace(/https?:\/\/([^ \n]+)/g, function (word) {
          return '<span class=\'link\'>' + (
            word.replace(/https?:\/\//g, '').length > 25 ? (word.replace(/https?:\/\//g, '').substr(0, 25) + '...') : (word.replace(/https?:\/\//g, ''))
          ) + '</span>'
        })
          .replace(/(^@[^ \n]+|\n@[^ \n]+| @[^ \n]+|^#[^ \n]*[^1234567890 \n][^ \n]*|\n#[^ \n]*[^1234567890 \n][^ \n]*| #[^ \n]*[^1234567890 \n][^ \n]*)/g, '<span class=\'link\'>$1</span>')
          .replace(/\n/g, '<br>')
          .replace(/  /g, '&nbsp; ')
        let templateInUse = template
        if (isMultiMode) {
          templateInUse = templates[0].content

          if (typeof templateChosen[i] === 'number') templateInUse = templates[templateChosen[i]].content
          else
            for (let j = 0; j < templates.length; j++)
              if (templates[j].name === templateChosen[i]) templateInUse = templates[j].content
        }
        $translateDiv.html(twemoji.parse(templateInUse.replace('{T}', translatedText)))
      }
    }
  }

  function getUrlParam(k) {
    let regExp = new RegExp('([?]|&)' + k + '=([^&]*)(&|$)')
    let result = window.location.href.match(regExp)
    if (result) {
      return decodeURIComponent(result[2])
    } else {
      return null
    }
  }

  function loadJS(url, callback) {
    let script = document.createElement('script'),
      fn = callback || function () {
      }
    script.type = 'text/javascript'
    if (script.readyState) {
      script.onreadystatechange = function () {
        if (script.readyState === 'loaded' || script.readyState === 'complete') {
          script.onreadystatechange = null
          fn()
        }
      }
    } else {
      script.onload = function () {
        fn()
      }
    }
    script.src = url
    document.getElementsByTagName('head')[0].appendChild(script)
  }

  if (getUrlParam('debug'))
    loadJS('https://cdn.bootcdn.net/ajax/libs/vConsole/3.3.4/vconsole.min.js', () => {
      new VConsole()
    })
  $(function () {
    if (getUrlParam('template') != null && getUrlParam('template').length > 0 && getUrlParam('out') == null) {
      $.get(getUrlParam('template'), function (data, status) {
        if (confirm('将要用链接的内容替代现有的翻译模板，确认覆盖？')) localStorage.setItem('translate-temp', data)
        window.location.href = '/'
      })
    }
    let $translateTemp = $('#translate-temp')
    $('#btnToggleTemplate').on('click', function () {
      if ($translateTemp.css('display') === 'none') {
        $translateTemp.show()
      } else {
        $translateTemp.hide()
      }
    })
    $('#button-submit').on('click', function () {
      saveUrlUser = true
      submit_task()
    })
    $('#button-submit-fast').on('click', function () {
      saveUrlUser = true
      submit_task(true)
    })
    if (localStorage.getItem('translate-temp') == null) localStorage.setItem('translate-temp', '<div style="margin:10px 38px">\n' +
      '<img src="img/nana_text.png" height="34">\n' +
      '<div style="font-size:20px;font-family: source-han-sans-simplified-c, sans-serif;font-weight: 400;font-style: normal;">{T}</div>\n' +
      '</div>')
    $translateTemp.val(localStorage.getItem('translate-temp'))
    $translateTemp.on('keyup', refresh_trans_div)
    $('.screenshot-wrapper').on('touchstart', function () {
      $('body').addClass('overview')
    })
    $('.settings-wrapper').on('touchstart', function () {
      $('body').removeClass('overview')
    })

    if (localStorage.getItem('lastUser') != null) $('#url').val('https://twitter.com/' + localStorage.getItem('lastUser'))
    {
      $('#url').on('keypress', function (event) {
        if (event.key === 'Enter') {
          submit_task(true)
        }
      })
    }


    if (getUrlParam('tweet') != null && getUrlParam('tweet').length > 0) {
      performanceData.autoBeforeTemplate = new Date().getTime()
      $.ajaxSetup({ async: false })
      if (getUrlParam('template') != null && getUrlParam('template').length > 0) {
        $.get(getUrlParam('template'), function (data) {
          localStorage.setItem('translate-temp', data)
          $translateTemp.val(localStorage.getItem('translate-temp'))
        })
      }
      $.ajaxSetup({ async: true })
      performanceData.autoAfterTemplate = new Date().getTime()
      $('#url').val(getUrlParam('tweet'))

      if (getUrlParam('translate') != null && getUrlParam('translate').length > 0) {
        defaultTranslate = getUrlParam('translate')

        defaultTranslate = defaultTranslate.replace(/\\n/g, '\n')

        $('.settings-container').hide()
        $('.auto-banner').show()
      } else if (getUrlParam('out') != null) {
        $('.settings-container').hide()
        $('.auto-banner').show()
      }
      if (defaultTranslate && defaultTranslate.trim().match(/^##[0-9]+$/gm) != null) submit_task(false)
      else submit_task(true)
    }
  })

  function downloadAsCanvas() {
    $('body')[0].scrollIntoView()
    dataLayer.push({ 'event': 'downloadPNG', 'tweetUrl': url })
    performanceData.beforeH2C = new Date().getTime()
    html2canvas(document.querySelector('#screenshots'), { useCORS: true }).then(canvas => {
      performanceData.afterH2C = new Date().getTime()
      //createAndDownloadFile("twitterImg" + new Date().getTime() + ".png", canvas.toDataURL("image/png"));
      if (getUrlParam('out') == null) {
        canvas.toBlob(function (blob) {
          saveAs(blob, 'twitterImg' + new Date().getTime() + '.png')

        })
      } else {
        $('body>*').hide()
        $('body').prepend(canvas)
      }
    })
  }

  return { downloadAsCanvas }
}()
