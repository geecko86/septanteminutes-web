<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html>
      <head>
        <title>RSS Feed</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
          }
          .container {
            width: 80%;
            margin: auto;
            overflow: hidden;
          }
          .item {
            background: #fff;
            margin: 20px 0;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 5px;
          }
          .item img {
            max-width: 100%;
            height: auto;
            display: block;
            margin-bottom: 10px;
          }
          .item h2 {
            margin: 0 0 10px;
          }
          .item p {
            margin: 0 0 10px;
          }
          .item .pubDate {
            color: #888;
            font-size: 0.9em;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>RSS Feed</h1>
          <xsl:for-each select="rss/channel/item">
            <div class="item">
              <xsl:if test="enclosure/@url">
                <img src="{enclosure/@url}" alt="{title}"/>
              </xsl:if>
              <h2><xsl:value-of select="title"/></h2>
              <p class="pubDate"><xsl:value-of select="pubDate"/></p>
              <p><xsl:value-of select="description"/></p>
              <p><a href="{link}">Read more</a></p>
            </div>
          </xsl:for-each>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>