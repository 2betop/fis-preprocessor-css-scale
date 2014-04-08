var CssFilter;
var NodeImage = require('images');

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

CssFilter = Object.derive(function( file, scale, ret, opt ) {
    this.scale = scale;

    // 确保这个文件compile过
    fis.compile( file );

    this.file = file;
    this.ret = ret;
    this.opt = opt;
    this._process();

}, {

    _process: function() {
        var ext, dst, file, content;

        file = this.file;

        if ( this.scale === 1 ) {
            this.dst = file;
        } else {
            ext = '_' + this.scale + 'x' + file.rExt;
            this.dst = fis.file.wrap( file.realpathNoExt + ext );
            this.content = file.getContent();

            this.parser();

            this.dst.setContent( this.content );
            this.ret.pkg[file.subpathNoExt + ext] = this.dst;
        }
    },

    parser: function() {
        var content = this.content;
        var rRuler = /[^{}]+{([^{}]*?(?:background|background-image)\s*\:[^;}]*?url\(('|")?(.*?)\2\)[^{}]*?)}/ig;
        var rNoScale = /(\?|&amp;|&)__noscale($|&amp;|&)/i;
        var rBas64 = /^data\:([^;]+?);base64,(.*?)$/i;

        // 只认px的。
        var rBgSize = /\s*[-\w]*background-size\s*\:\s*([\d\.]+)px\s+([\d\.]+)px\s*(;|$)/img;
        var me = this;

        content = content.replace( rRuler, function( ruler, body, _, value ) {
            var info, file, img, imgResized, ext, buf, m, type, prefix;
            var mSize, w, h, ow, oh, indent, white;

            // 如果明确指定不缩放，则跳过此图片。
            if ( rNoScale.test( value ) ) {
                return ruler.replace( value, value.replace( rNoScale, '$1$2').replace(/(?:\?|&amp;|&)$/i, '' ) );
            }

            m = rBas64.exec( value );

            // 如果是base64
            if ( m ) {
                buf = new Buffer( m[2], 'base64' );
                type = /^image\/(.*?)$/i.test( m[ 1 ] ) && RegExp.$1;
                type = '.' + (type || 'png');
                img = new NodeImage( buf );
                ow = img.width();
                oh = img.height();
                img.resize( img.width() * me.scale );
                buf = img.encode( type );
                prefix = 'data:' + fis.util.getMimeType( type ) + ';base64,';
                ruler = ruler.replace( value, prefix + fis.util.base64(buf) );
            } else {
                info = fis.uri( value, me.file.dirname );
                file = findFileInArray( info.rest, me.ret.src, me.opt );

                if ( !file ) {
                    fis.log.error( info.rest + ' not found!' );
                    return ruler;
                }

                img = new NodeImage( file.getContent() );
                ow = img.width();
                oh = img.height();
                img.resize( img.width() * me.scale );

                ext = '_' + me.scale + 'x' + file.rExt;
                imgResized = fis.file.wrap( file.realpathNoExt + ext );
                imgResized.setContent( img.encode( file.rExt ) );
                me.ret.pkg[file.subpathNoExt + ext] = imgResized;

                ruler = ruler.replace(/url\(('|")?.*?\1\)/ig, function( _, quote ) {
                    quote = quote || '';
                    return 'url(' + quote + me.getFileUrl( imgResized, info ) +  quote + ')';
                });
            }

            w = img.width();
            h = img.height();

            mSize = rBgSize.exec( ruler );
            if ( mSize ) {
                ruler = ruler.replace( rBgSize, function( _, width, height ) {
                    var scaleX, scaleY;

                    width = parseFloat( width );
                    height = parseFloat( height );

                    if ( Math.abs( Math.round( width - w ) ) < 2 &&
                        Math.abs( Math.round( height - h ) ) < 2 ) {
                        return '';
                    }

                    return _;
                });
            } else {
                indent = /(?:\n|(?:\r\n)|\r)(\s+)[\w\-]/m.exec( ruler );
                indent = indent ? indent[1].length : 4;
                white = '';
                while ( --indent ) {
                    white += ' ';
                }


                ruler = ruler.replace( /}/, function() {
                    return white + 'background-size: ' + ow + 'px ' + oh + 'px;\n}';
                });
            }

            return ruler;
        });

        this.content = content;
    },

    getFileUrl: function( file, info ) {
        var url, hash, query;

        url = file.getUrl( this.opt.hash, this.opt.domain );
        hash = info.hash || file.hash || '';
        query = info.query || file.query || '';

        return url + query + hash;
    },

    getResult: function() {
        return this.dst;
    }
});

module.exports = CssFilter.factory();