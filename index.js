/**
 * 背景：现在大部分的手机都是高清屏的，为了得到更好的用户体验，我们设置图片时总是喜欢提供一个
 * 2倍大小的图片。但是如果用户的网络不给力，是不是完全不用这么奢侈地请求一张高质量的图片？于
 * 是我们打算提供两份样式表，一份给高网速，一份给低网速。但是这两份样式表维护起来比较麻烦，且
 * 相似度极高。
 *
 * 方案：只写一份高清版本，正常版本通过此程序自动生成。
 *
 * @fileOverview 用来缩放样式表，当然主要还是缩放图片的。
 */

var map = fis.compile.lang;
var embeddedMap = {};

function error(msg){
    //for watching, unable to exit
    embeddedMap = {};
    fis.log.error(msg);
}

function embeddedCheck(main, embedded){
    main = fis.file.wrap(main).realpath;
    embedded = fis.file.wrap(embedded).realpath;
    if(main === embedded){
        error('unable to embed file[' + main + '] into itself.');
    } else if(embeddedMap[embedded]) {
        var next = embeddedMap[embedded],
            msg = [embedded];
        while(next && next !== embedded){
            msg.push(next);
            next = embeddedMap[next];
        }
        msg.push(embedded);
        error('circular dependency on [' + msg.join('] -> [') + '].');
    }
    embeddedMap[embedded] = main;
    return true;
}

function embeddedUnlock(file){
    delete embeddedMap[file.realpath];
}

function addDeps(a, b){
    if(a && a.cache && b){
        if(b.cache){
            a.cache.mergeDeps(b.cache);
        }
        a.cache.addDeps(b.realpath || b);
    }
}

// --------------------------------
// ---------------------------------
var cssFilter = require('./lib/cssFilter.js');

var rEmbed = /(\?|&amp;|&)__(?:embed|inline)(&amp;|&|$)/i;
var rScale = /(\?|&amp;|&)__scale(?:=([^&]*?))?(&amp;|&|$)/i;

// 全局变量，函数中多处用到。
var ld, rd;

function isInline( info ) {
    return rEmbed.test( info.query );
}

function parseHtml( content, file, ret, opt ) {
    var escapedLd = fis.util.escapeReg(ld);
    var escapedRd = fis.util.escapeReg(rd);

    // 匹配style
    var rStyle = '(?:(<style[^>]*?>)([\\s\\S]*?)(?=<\\/style\\s*>))';

    // 匹配{%style%}{%/style%}
    var rStyle2 = '(?:(' + escapedLd + 'style[^>]*?' + escapedRd +
            ')([\\s\\S]*?)(?=' + escapedLd + '\\/style\\s*' + escapedRd + '))';

    // 匹配link
    var rLink = '(?:<(link)\\s+[\\s\\S]*?>)';

    // html 注释
    var rComment = '(<\\!--[\\s\\S]*?(?:-->|$))';

    // smarty注释
    var rComment2 = '(' + escapedLd + '\\*[\\s\\S]*?(?:\\*' + escapedRd +'|$))';

    // 匹配href
    var rHref = /(\s*(?:data-)?href\s*=\s*)('|")(.*?)\2/ig;

    var rName = /(\s*name\s*=\s*)('|")(.*?)\2/ig;

    var rRequire = '(?:' + escapedLd + 'require\\s+([\\s\\S]*?)' + escapedRd+ ')'


    // 合并这些规则，写一起实在是太长了，也分不开。
    var reg  = new RegExp([ rComment, rComment2, rStyle, rStyle2, rLink, rRequire ].join('|'), 'gi' );

    return content.replace( reg, function( all, c1, c2, s11, s12, s21, s22, m3, m4 ) {
        var inline = '',
            ref, isCssLink;

        // 忽略注释
        if ( c1 || c2 ) {
            return all;
        } else if ( s11 ) {
            // style部分
            all = s11 + parseCss( s12, file, ret, opt );
        } else if ( s22 ) {
            // {%style%}部分
            // console.log( s22, file.subpath );
            all = s21 + parseCss( s22, file, ret, opt );
        } else if ( m3 ) {

            // 不判断了，肯定是link
            ref = /\s+rel\s*=\s*('|")(.*?)\1/i.exec( all );
            ref = ref && ref[ 2 ].toLowerCase();

            isCssLink = ref === 'stylesheet';

            if ( !isCssLink && ref !== 'import' ) {
                return all;
            }

            all = all.replace( rHref, function( _, prefix, quote, value ) {
                var info = fis.util.query( value );

                if ( isInline( info ) ) {

                    if( isCssLink ) {
                        inline += '<style' + all.substring(5)
                                .replace(/\/(?=>$)/, '')
                                .replace(/\s+(?:charset|href|data-href|hreflang|rel|rev|sizes|target)\s*=\s*(?:'[^']+'|"[^"]+"|[^\s\/>]+)/ig, '');
                    }

                    inline += map.embed.ld + quote + value.replace( rEmbed, '$1$2' ).replace(/(?:\?|&amp;|&)$/i, '' ) + quote + map.embed.rd;

                    if( isCssLink ) {
                        inline += '</style>';
                    }

                    return '';
                } else {
                    return prefix + map.uri.ld + quote + value + quote + map.uri.rd;
                }
            });

        } else if ( m4 ) {

            // {%require name="xxx"%}
            // 只处理css类文件。

            // console.log( m4 );
            all = all.replace( rName, function( _, prefix, quote, value ) {

                var info = fis.uri( value, file.dirname );
                var pos = info.rest.indexOf(':');
                var ns = ~pos ? info.rest.substring( 0, pos ) : '';

                // 如果路径是带namespace的，可能用户会写错
                // 出现这种case: namespace:/path/xxx.xxx
                // 应该是: namespace:path/xxx.xxx
                if ( ns ) {
                    info.rest = info.rest.replace( new RegExp( '(' +
                            fis.util.escapeReg( ns ) + ':)/', 'ig' ), '$1' );
                }

                var f = ns ? ret.ids[ info.rest ] : findFileInArray( info.rest, ret.src, opt );

                // 只处理css文件。
                if ( !f || !f.isCssLike ) {
                    return _;
                }

                if ( isInline( info ) ) {
                    inline = ld + 'style' + all.substring( ld.length + 8, all.length - rd.length).replace(rName, '') + rd;

                    inline += '\n'+map.embed.ld + quote + value.replace( rEmbed, '$1$2' ).replace(/(?:\?|&amp;|&)$/i, '') + quote + map.embed.rd;

                    inline += '\n' + ld+'/style'+rd;
                } else if ( rScale.test( value ) ) {
                    return prefix + map.uri.ld + quote + value + quote + map.uri.rd;
                }

                return _;
            });
        }

        return inline || all;
    });
}


function parseCss( content, file, ret, opt ) {
    var reg = /(\/\*[\s\S]*?(?:\*\/|$))|((?:@import\s+)url\(\s*('|\")(.*?)\3\)\s*)/g;
    return content.replace( reg, function( _, comment, url, quote, value ) {
        if ( comment ) {
            return _;
        }

        // console.log( value );

        var info = fis.uri( value, file.dirname );
        var pos = info.rest.indexOf(':');
        var ns = ~pos ? info.rest.substring( 0, pos ) : '';

        // 如果路径是带namespace的，可能用户会写错
        // 出现这种case: namespace:/path/xxx.xxx
        // 应该是: namespace:path/xxx.xxx
        if ( ns ) {
            info.rest = info.rest.replace( new RegExp( '(' +
                    fis.util.escapeReg( ns ) + ':)/', 'ig' ), '$1' );
        }

        var f = ns ? ret.ids[ info.rest ] : findFileInArray( info.rest, ret.src, opt );

        // 只处理css文件。
        if ( !f || !f.isCssLike ) {
            return _;
        }

        if ( isInline( info ) ) {
            return map.embed.ld + quote + value.replace( rEmbed, '$1$2' ).replace(/(?:\?|&amp;|&)$/i, '') + quote + map.embed.rd;
        } else if ( rScale.test( value ) ) {
            // console.log( value );
            return '@import url(' + map.uri.ld + quote + value + quote + map.uri.rd +')';
        }

        return _;
    });
}

function findFileInArray( path, lookup, opt ) {
    var target;

    fis.util.map( lookup, function( subpath, file ) {
        if ( file.getUrl( opt.hash, opt.domain ) == path ) {
            target = file;
            return true;
        }
    });

    return target;
}

function _process( file, ret, opt ) {

    // 只处理html类或css类文件。
    if ( !file.isHtmlLike && !file.isCssLike ) {
        return;
    }

    var content = file.getContent();

    if ( file.isHtmlLike ) {
        content = parseHtml( content, file, ret, opt );
    } else if ( file.isCssLike ) {
        content = parseCss( content, file, ret, opt );
    }

    content = content.replace( map.reg, function( all, type, value ) {
        var str = '', info, src, dst, filter, scale, url, hash;

        info = fis.uri( value, file.dirname );
        scale = rScale.exec( info.query );
        scale = (scale ? parseFloat( scale[ 2 ] ) || 0.5 : 0) || 1;

        var pos = info.rest.indexOf(':');
        var ns = ~pos ? info.rest.substring( 0, pos ) : '';

        // 如果路径是带namespace的，可能用户会写错
        // 出现这种case: namespace:/path/xxx.xxx
        // 应该是: namespace:path/xxx.xxx
        if ( ns ) {
            info.rest = info.rest.replace( new RegExp( '(' +
                    fis.util.escapeReg( ns ) + ':)/', 'ig' ), '$1' );
        }

        src = ns ? ret.ids[ info.rest ] : findFileInArray( info.rest, ret.src, opt );
        if ( !src ) {
            fis.log.warning( info.rest + ' not found.');
            return value;
        }


        if ( !src.isCssLike || ns && ns !== fis.config.get('namespace') ) {
            return value;
        }

        if ( type === 'embed' && embeddedCheck( file, src ) ) {
            _process( src );
            addDeps( file, src ); //添加依赖
            embeddedUnlock( src );
        }

        // 不处理scale为1.0的。
        if ( ~~scale === 1 ) {
            dst = src;
        } else {
            filter = new cssFilter( src, scale, ret, opt );
            dst = filter.getResult();
        }

        if ( type === 'embed' ) {
            str = dst.getContent();
        } else if ( type === 'uri' ) {
            if ( ns ) {
                str = info.quote + dst.getId() + info.quote;
            } else {
                url = dst.getUrl( opt.hash, opt.domain );
                hash = info.hash || dst.hash;
                str = info.quote + url  + info.query.replace( rScale, '$1$3' )
                        .replace(/(?:\?|&amp;|&)$/i, '' ) + hash + info.quote;
            }
        }

        return str;
    });

    file.setContent( content );
}

var hack = require('./lib/hack.js');

// 程序入口
module.exports = function( content, file, settings ) {
    return hack( prepackager, content, file, settings );
};

function prepackager( ret, conf, settings, opt ) {
    ld = settings.left_delimiter || fis.config.get('settings.smarty.left_delimiter') || '{%';
    rd = settings.right_delimiter || fis.config.get('settings.smarty.right_delimiter') || '%}';

    fis.util.map( ret.src, function( subpath, file ) {
        _process( file, ret, opt );
    });
}