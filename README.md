CSS 缩放器
=========================

## 背景

主要针对无线端，目前无线端高清屏幕越来越多，为了让网页得到更好的用户体验，我们往往需要为高清
屏幕提供2倍大小的背景图片。

但是，有时候用户所在的网络缓慢至极，用户无福消受高清版本，且某些用户甚至都不是用的高清屏幕，
于是我们又需要提供一份非高清版本的样式，根据条件自动加载。

于是我们需要维护两份样式表，这样便带来的一定的维护成本。

## 解决方案

> 如何解决样式表针对不同的终端带来的维护成本问题？

> 默认只提供高清版本，普通版本自动生成如何？

> Excellent, 此程序就是用来干这个事情的。

## 具体细节

针对高清屏幕的样式，我们往往会这么写。

```css
.ruler {
    background: url('xxx_200x200.png');
    background-size: 100px 100px;
}
```

把它转成普通屏幕的大小的样式，我们主要做了两步。

1. 把图片`xxx_200x200.png`缩小一倍， 变成`xxx_100x100.png`。
2. 去掉`background-size`一条。

最终变成。

```css
.ruler {
    background: url('xxx_100x100.png');
}
```

## 如何使用？

直接看demo吧。

### 外链样式表资源。

普通html文件

```html
<html>
    ...
    <!--引入style.css, 同时把它缩放成0.5呗。-->
    <link rel="stylesheet" type="text/css" href="/static/css/style.css?__scale=0.5">
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
    <!--否则，引入style.css, 同时把它缩放成0.5呗。-->
    <link rel="stylesheet" type="text/css" href="/static/css/style.css?__scale=0.5">
    {%/if%}
    ...
</html>
```

### 内联样式表

普通html文件

```html
<html>
    ...
    <!--内嵌style.css, 同时把它缩放成0.5呗。-->
    <link rel="stylesheet" type="text/css" href="/static/css/style.css?__scale=0.5&amp;__embed">
    ...
</html>
```

tpl文件

```html
{%if $condition%}
    <!--如果使用高清版本，则使用原始高清版本-->
    {%style%}
    @import url('/static/css/style.css?__embed');
    {%/style%}
{%else%}
    <!--否则，内嵌style.css, 同时把它缩放成0.5呗。-->
    {%style%}
    @import url('/static/css/style.css?__embed&__scale=0.5');
    {%/style%}
{%/if%}
```

也可以

```html
{%if $condition%}
    <!--如果使用高清版本，则使用原始高清版本-->
    {%require name="/static/css/style.css?__embed"%}
{%else%}
    <!--否则，内嵌style.css, 同时把它缩放成0.5呗。-->
    {%require name="/static/css/style.css?__embed&__scale=0.5"%}
{%/if%}
```