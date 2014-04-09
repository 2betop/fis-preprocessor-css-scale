/**
 * hack into fis core!
 */
/*
// a flag
var hacked = false;
var origin;

module.exports = function() {

    // skip duplicate.
    if ( hacked ) {
        return;
    }

    origin = fis.uri;

    fis.uri = uri;
    fis.map( origin, function( key, value ) {
        uri[ key ] = value;
    });
    uri.prototype = origin.prototype;

    hacked = true;
};

module.exports.unhack = function() {
    origin && (fis.uri = origin);
    hacked =  false;
};

// hacked into fis.uri
function uri() {
    var info =  origin.apply( this, arguments );

    return info;
}*/
var rInline = /(\?|&amp;|&)__inline(&amp;|&|$)/i;
var rScale = /(\?|&amp;|&)__scale=([^&]*?)(&amp;|&|$)/i;

var ld, rd;

function parseCss( content, file, smarty ) {
    var reg = /(\/\*[\s\S]*?(?:\*\/|$))|((?:@import\s+)url\(\s*('|\")(.*?)\3\)\s*)/g;
    return content.replace( reg, function( _, comment, url, quote, value ) {
        if ( comment ) {
            return _;
        }

        if ( rScale.test( value ) ) {
            if ( smarty ) {
                value = convertPath( value, file );
            }
            return '@import url(' + quote + value.replace( rInline, '$1__embed$2') + quote + ')';
        }

        return _;
    });
}

function convertPath( value, file ) {
    var info = fis.uri( value, fis.dirname );
    var query, url, hash;

    if ( info.file && info.file.isFile() ) {
        query = (info.file.query && info.query) ? '&' + info.query.substring(1) : info.query;
        url = info.file.getUrl(fis.compile.settings.hash, fis.compile.settings.domain);
        hash = info.hash || info.file.hash;
        value = url + query + hash;
    }

    return value;
}

function parseHtml( content, file ) {
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

    var rRequire = '(?:' + escapedLd + 'require\\s+([\\s\\S]*?)' + escapedRd+ ')';

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
            all = s11 + parseCss( s12, file );
        } else if ( s22 ) {
            // {%style%}部分
            all = s21 + parseCss( s22, file, true );
        } else if ( m3 ) {
            ref = /\s+rel\s*=\s*('|")(.*?)\1/i.exec( all );
            ref = ref && ref[ 2 ].toLowerCase();

            isCssLink = ref === 'stylesheet';

            if ( !isCssLink && ref !== 'import' ) {
                return all;
            }

            all = all.replace( rHref, function( _, prefix, quote, value ) {
                if ( rScale.test( value ) ) {
                    return prefix + quote + value.replace( rInline, '$1__embed$2') + quote;
                }

                return _;
            });
        } else if ( m4 ) {

            // {%require name="xxx"%}
            // 只处理css类文件。
            // console.log( m4 );
            all = all.replace( rName, function( _, prefix, quote, value ) {
                value = convertPath( value, file );
                return prefix + quote + value.replace( rInline, '$1__embed$2') + quote;
            });
        }

        return all;
    });
}

var inited = false;
function init( prepackager, settings ) {
    if ( inited ) {
        return;
    }

    ld = settings.left_delimiter || fis.config.get('settings.smarty.left_delimiter') || '{%';
    rd = settings.right_delimiter || fis.config.get('settings.smarty.right_delimiter') || '%}';

    var processors = fis.config.get('modules.prepackager');
    var typeOf = typeof processors;

    if( typeOf === 'string' ) {
        processors = processors.trim().split(/\s*,\s*/);
    } else if( typeOf === 'function' ) {
        processors = [ processors ];
    }

    processors.push( prepackager );

    fis.config.set( 'modules.prepackager', processors );

    inited = true;
}

module.exports = function( prepackager, content, file, settings ) {
    init( prepackager, settings );

    if ( file.isHtmlLike ) {
        content = parseHtml( content, file );
    } else if ( file.isCssLike ) {
        content = parseCss( content, file );
    }

    return content;
};