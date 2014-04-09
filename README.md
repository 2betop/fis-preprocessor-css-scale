CSS 缩放器
=========================
什么是css缩放器？
> 其实就是针对背景图片进行缩放，因为是跟样式捆绑的，所以我们叫样式缩放器。

## 背景

主要针对无线端，目前无线端高清屏幕越来越多，为了让网页得到更好的用户体验，我们往往需要为高清
屏幕提供2倍大小的背景图片。

但是，有时候用户所在的网络环境不理想，加载非高清版本，能够让内容更快的呈现出来，
于是我们又需要提供一份非高清版本的样式，根据用户网络情况进行切换。

于是，我们需要维护两份相似度很高的样式表，这样便带来了一定的维护成本。

## 解决方案

> 如何解决样式表针对不同的终端带来的维护成本问题？
>> 默认只提供高清版本，普通版本自动生成如何？
>>> Excellent, 此程序就是用来实现此方案的。

## 具体细节

针对高清屏幕的样式，我们往往会这么写。

```css
.ruler {
    background: url('xxx_200x200.png');
    background-size: 100px 100px;
}
```

把它转成普通版本的样式，需要两步。

1. 把图片`xxx_200x200.png`，通过`photoshop`缩小一倍， 变成`xxx_100x100.png`。
2. 去掉`background-size`一条。

最终变成。

```css
.ruler {
    background: url('xxx_100x100.png');
}
```

当然还有更多细节处理，这里不列出来！

## 如何使用？

在引入css文件的时候通过query`__scale`来指定缩放比，比如： `xxx.css?__scale=0.5`。
`xxx.css?__scale`等价于`xxx.css?__scale=0.5`， 如果需要指定其他缩放值可以这样设置，
`xxx.css?__scale=0.75`。

### 外链样式表资源。

普通html文件

```html
<html>
    ...
    <!--引入style.css, 同时把它缩放成0.5倍。-->
    <link rel="stylesheet" type="text/css" href="/static/css/style.css?__scale">
    ...
    <style type="text/css">
    @import url('/static/css/style.css?__scale');

    .ruler {
        width: auto;
    }
    </style>
    ...
</html>
```

tpl文件

```html
<html>
    ...
    {%if $condition %}
    <!--如果使用高清版本，则使用原始高清版本-->
    <link rel="stylesheet" type="text/css" href="/static/css/style.css">
    {%else%}
    <!--否则，引入style.css, 同时把它缩放成0.5倍。-->
    <link rel="stylesheet" type="text/css" href="/static/css/style.css?__scale">
    {%/if%}
    ...
</html>
```

### 内联样式表

普通html文件

```html
<html>
    ...
    <!--内嵌style.css, 同时把它缩放成0.5倍。-->
    <link rel="stylesheet" type="text/css" href="/static/css/style.css?__scale&amp;__inline">
    <!--或者-->
    <style type="text/css">
        @import url('/static/css/style.css?__scale&amp;__inline');
    </style>
    ...
</html>
```

tpl文件, 注意：这里用的是{%style%}smarty插件语法，目的是为了能做到条件输出。
同时，能保证这里面的样式是在页面头部输出的。像普通的内联方式，是无法做到条件内联头部输出的。

```html
{%if $condition%}
    <!--如果使用高清版本，则使用原始高清版本-->
    {%style%}
    @import url('/static/css/style.css?__inline');
    {%/style%}
{%else%}
    <!--否则，内嵌style.css, 同时把它缩放成0.5倍。-->
    {%style%}
    @import url('/static/css/style.css?__inline&amp;__scale');
    {%/style%}
{%/if%}
```

也可以这样写！

```html
{%if $condition%}
    <!--如果使用高清版本，则使用原始高清版本-->
    {%require name="/static/css/style.css?__inline"%}
{%else%}
    <!--否则，内嵌style.css, 同时把它缩放成0.5倍。-->
    {%require name="/static/css/style.css?__inline&amp;__scale"%}
{%/if%}
```

## 如何开启此插件？

* 安装npm包。
```bash
npm install -g fis-preprocessor-css-scale
```
* 配置`fis-conf.js`，针对css, html, tpl文件启用此功能！
```javascript
fis.config.merge({
    ...
    modules : {
        preprocessor: {
            css: 'css-scale',
            html: 'css-scale',
            tpl: 'css-scale'
        }
    },
    ...
});
```

## 担心图片自动缩放效果不好？

完全不用担心，效果与`photoshop`缩放的效果非常接近。

scale 0.2倍。

系统：![系统缩放](./scale.png)
Photoshop: ![photoshop缩放](./photoshop.png)

## 如果不想让某个背景图片自动缩放，怎么办？
默认样式表中所有图片，在此样式缩放的时候都会跟着缩放。如果某个图片不想被缩放，怎么办？

设置一个noScale属性就ok了。如下：

```css
.ruler {
    background: url(xxx.png?__noscale);
}
```