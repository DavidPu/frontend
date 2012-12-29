var TBX = (function() {
  var callbacks, crumb, log, markup, profiles, pushstate, tags, pathname, util;

  callbacks = {
    loginSuccess: function() {
      var redirect = $('input[name="r"]', this).val();
      window.location.href = redirect;
    },
    profilesSuccess: function(owner, viewer) {
      profiles.owner = owner;
      op.data.store.Profiles.add(profiles.owner);
      if(viewer !== undefined) {
        profiles.viewer = viewer;
        op.data.store.Profiles.add(profiles.viewer);
      }

      $('.profile-name-meta').each(function(i, el) {
        (new op.data.view.ProfileName({model:op.data.store.Profiles.get(profiles.owner.id), el: el})).render();
      });
      $('.profile-photo-meta').each(function(i, el) {
        (new op.data.view.ProfilePhoto({model:op.data.store.Profiles.get(profiles.owner.id), el: el})).render();
      });
      (new op.data.view.ProfilePhoto({model:op.data.store.Profiles.get(profiles.viewer.id), el: $('.profile-photo-header-meta')})).render();
    }
  };
  crumb = (function() {
    var value = null;
    return {
      get: function() {
        return value;
      },
      set: function(crumb) {
        value = crumb;
      }
    };
  })();
  profiles = {
    owner: { },
    viewer: { },
    load: function() {
      // TODO cache this somehow
      $.get('/user/profile.json', {includeViewer: '1'}, function(response) {
        if(response.code !== 200)
          return;

        var result = response.result, id = result.id, owner = result, viewer = result.viewer || null;
        if(owner.viewer !== undefined)
          delete owner.viewer;

        callbacks.profilesSuccess(owner, viewer);
      }, 'json');
    }
  };
  util = (function() {
    return {
      getDeviceWidth: function() {
        return $(window).width();
      },
      fetchAndCache: function(src) {
        $('<img />').attr('src', src).appendTo('body').css('display', 'none').on('load', function(ev) { $(ev.target).remove(); });
      },
      fetchAndCacheNextPrevious: function() {
        var nextPhoto = $('img.next-photo'), prevPhoto = $('img.previous-photo');
        if(prevPhoto.length > 0)
          OP.Util.fire('preload:photo', {id: prevPhoto.attr('data-id'), sizes:'870x550'});
        if(nextPhoto.length > 0)
          OP.Util.fire('preload:photo', {id: nextPhoto.attr('data-id'), sizes:'870x550'});
      }
    };
  })();

  return {
    crumb: function() { return crumb.get(); },
    handlers: {
      submit: {
        login: function(ev) {
          ev.preventDefault();
          var form = $(ev.target),
              params = form.serialize();
          params += '&httpCodes=403';
          $.ajax(
            {
              url: '/user/self/login.json',
              dataType:'json',
              data:params,
              type:'POST',
              success: callbacks.loginSuccess,
              error: function() { console.log('f'); },//opTheme.callback.loginOpenPhotoFailedCb,
              context: form
            }
          );
          return false;
        }
      },
      click: {
      },
      keydown: {
      },
      keyup: {
      },
      mouseover: {
      }
    },
    init: {
      load: function(_crumb) {
        // http://stackoverflow.com/a/6974186
        // http://stackoverflow.com/questions/6421769/popstate-on-pages-load-in-chrome/10651028#10651028
        var popped = ('state' in window.history && window.history.state !== null);

        crumb.set(_crumb);
        OP.Tag.init();
        pathname = location.pathname;

        /* jm History.Adapter.bind(window,'statechange',function(){
          var State = History.getState(),
              initialPop = !popped && location.href == initialURL;
          popped = true;
          if(initialPop)
            return;

          pushstate.render(State.data);
        });*/

        // TODO cache in local storage

        profiles.load();

        if(location.pathname === '/')
          TBX.init.pages.front();
        else if(location.pathname === '/manage/photos')
          TBX.init.pages.manage.photos();
        else if(location.pathname.search(/^\/photos(.*)\/list/) === 0)
          TBX.init.pages.photos.init();
        else if(location.pathname.search(/^\/p\/[a-z0-9]+/) === 0 || location.pathname.search(/^\/photo\/[a-z0-9]+\/?(.*)\/view/) === 0)
          TBX.init.pages.photo.init();
        else if(location.pathname === '/photos/upload')
          TBX.init.pages.upload();
      },
      pages: {
        photos: {
          // TODO have a better way of sending data into the JS framework. See #780
          initData: typeof(initData) === "undefined" ? undefined : initData,
          filterOpts: typeof(filterOpts) === "undefined" ? undefined : filterOpts,
          page: null,
          pageCount: 0,
          pageLocation: window.location,
          maxMobilePageCount: 5,
          end: false,
          running: false,
          init: function() {
            var _this = TBX.init.pages.photos;
            $(window).scroll(_this.scrollCb);
            _this.load();
          },
          scrollCb: function(){
            var _this = TBX.init.pages.photos;
            // don't autoload if the width is narrow
            //  crude way to check if we're on a mobile device
            //  See #778
            if(util.getDeviceWidth() < 900)
              return;

            if($(window).scrollTop() > $(document).height() - $(window).height() - 200){
              _this.load();
            }
          },
          load: function() {
            var _this = TBX.init.pages.photos; loc = location;
            Gallery.setConfig('marginsOfImage', 10);
            // we define initData at runtime to avoid having to make an HTTP call on load
            // all subsequent calls run through the http API
            if(typeof(_this.initData) === "undefined") {
              if(_this.end || _this.running)
                return;

              _this.running = true;

              if(_this.page === null) {
                var qsMatch = loc.href.match('page=([0-9]+)');
                if(qsMatch !== null) {
                  _this.page = qsMatch[1];
                } else {
                  var uriMatch = loc.pathname.match(/\/page-([0-9]+)/);
                  if(uriMatch !== null) {
                    _this.page = uriMatch[1];
                  }
                }

                if(_this.page === null)
                  _this.page = 1;
              }

              var api = _this.pageLocation.pathname+'.json';
                  params = {}, qs = _this.pageLocation.search.replace('?', '');
              
              if(qs.length > 0) {
                var qsKeyValueStrings = qs.split('&'), qsKeyAndValue;
                for(i in qsKeyValueStrings) {
                  if(qsKeyValueStrings.hasOwnProperty(i)) {
                    qsKeyAndValue = qsKeyValueStrings[i].split('=');
                    if(qsKeyAndValue.length === 2) {
                      params[qsKeyAndValue[0]] = qsKeyAndValue[1];
                    }
                  }
                }
              }

              params.returnSizes = '960x180';
              params.page = _this.page;

              // for mobile devices limit the number pages before a full page refresh. See #778
              if(_this.pageCount > _this.maxMobilePageCount && util.getDeviceWidth() < 900) {
                location.href = _this.pageLocation.pathname + '?' + decodeURIComponent($.param(params));
              } else {
                $.getJSON(api, params, _this.loadCb);
              }
            } else {
              delete _this.initData;
              _this.page = 1;
              var response = {code:200, result:initData};
              op.data.store.Photos.add( response.result );
              _this.loadCb(response);
            }
          },
          loadCb: function(response) {
            var items = response.result, _this = TBX.init.pages.photos, infobar = $('.infobar'),
                minDate = $('.startdate', infobar), maxDate = $('.enddate', infobar),
                minDateVal = parseInt(minDate.attr('data-time')), maxDateVal = parseInt(maxDate.attr('data-time')),
                ui = TBX.ui, i;
            if(items[0].totalPages >= _this.page) {

              var thisTaken;
              for(i=0; i<items.length; i++) {
                thisTaken = parseInt(items[i].dateTaken);
                if(thisTaken > maxDateVal) {
                  ui.fadeAndSet(maxDate, phpjs.date('l F jS, Y', thisTaken));
                  maxDate.attr('data-time', thisTaken);
                  maxDateVal = thisTaken;
                } else if(parseInt(items[i].dateTaken) < parseInt(minDate.attr('data-time'))) {
                  ui.fadeAndSet(minDate, phpjs.date('l F jS, Y', thisTaken));
                  minDate.attr('data-time', thisTaken);
                  minDateVal = thisTaken;
                }
              }

              Gallery.showImages($(".photo-grid"), items);
              _this.page++;
              _this.pageCount++;
              _this.running = false;
            } else {
              $('.load-more').hide();
              op.data.store.Photos.add( items.result );
              _this.end = true;
            }
          }
        }
      }
    },
    profiles: {
      getOwner: function() {
        return profiles.owner.id;
      },
      getViewer: function() {
        return profiles.viewer.id;
      }
    }
  };
})();
