# Live Meta Integration Test Report
*Generated: 2026-07-07T19:28:40.904Z*

**Graph API:** v23.0 | **Page:** Smriti (1165738093294228) | **IG:** @smritifyp (17841411718913026)

---

## Summary

| Result | Count |
|--------|-------|
| ✅ PASS | 13 |
| ❌ FAIL | 5 |
| ⚠️ SKIP | 2 |
| **Total** | **20** |

---

## Detailed Results

### ✅ PASS — Debug Page Access Token

| Field | Value |
|-------|-------|
| **Request** | `GET https://graph.facebook.com/v23.0/debug_token?input_token=***TOKEN***&access_token=1942455143138800|***SECRET***` |
| **HTTP Code** | `200` |
| **Duration** | `1994ms` |
| **Status** | ✅ PASS |

**Response:**
```json
{
  "data": {
    "app_id": "1942455143138800",
    "type": "PAGE",
    "application": "FlowFyp",
    "data_access_expires_at": 1791201612,
    "expires_at": 0,
    "is_valid": true,
    "issued_at": 1783430674,
    "profile_id": "1165738093294228",
    "scopes": [
      "read_insights",
      "pages_show_list",
      "business_management",
      "pages_messaging",
      "instagram_basic",
      "instagram_manage_comments",
      "instagram_manage_insights",
      "instagram_content_publish",
      "instagram_manage_messages",
      "pages_read_engagement",
      "pages_manage_metadata",
      "pages_read_user_content",
      "pages_manage_posts",
      "pages_manage_engagement",
      "whatsapp_business_messaging",
      "manage_app_solution",
      "pages_utility_messaging",
      "paid_marketing_messages",
      "whatsapp_business_manage_events",
      "instagram_manage_contents",
      "public_profile"
    ],
    "granular_scopes": [
      {
        "scope": "pages_show_list"
      },
      {
        "scope": "business_management"
      },
      {
        "scope": "pages_messaging"
      },
      {
        "scope": "instagram_basic"
      },
      {
        "scope": "instagram_
... (truncated)
```

---

### ❌ FAIL — Get /me/permissions

| Field | Value |
|-------|-------|
| **Request** | `GET https://graph.facebook.com/v23.0/me/permissions` |
| **HTTP Code** | `400` |
| **Duration** | `359ms` |
| **Status** | ❌ FAIL |
| **Graph Error** | `[100] (#100) Tried accessing nonexisting field (permissions) (OAuthException)` |

**Response:**
```json
{
  "error": {
    "message": "(#100) Tried accessing nonexisting field (permissions)",
    "type": "OAuthException",
    "code": 100,
    "fbtrace_id": "AM1cZvNfdiL1WrZikQ2I944"
  }
}
```

---

### ✅ PASS — Get Page Info

| Field | Value |
|-------|-------|
| **Request** | `GET https://graph.facebook.com/v23.0/1165738093294228?fields=id,name,fan_count,link,category,about,website,phone,picture` |
| **HTTP Code** | `200` |
| **Duration** | `822ms` |
| **Status** | ✅ PASS |

**Response:**
```json
{
  "id": "1165738093294228",
  "name": "Smriti",
  "fan_count": 0,
  "link": "https://www.facebook.com/1165738093294228",
  "category": "Reel creator",
  "picture": {
    "data": {
      "height": 50,
      "is_silhouette": true,
      "url": "https://scontent.fnag1-2.fna.fbcdn.net/v/t1.30497-1/453178253_471506465671661_2781666950760530985_n.png?stp=cp0_dst-png_s50x50&_nc_cat=1&ccb=1-7&_nc_sid=8f254b&_nc_ohc=VdB2db4QHhMQ7kNvwHV4iKy&_nc_oc=AdpUOtu31ZdvSmPONCUy_NHbKwqCXaHiG2-rZJXTdbuV-GwD_CHZJUk51iW45LfbZ3M&_nc_zt=24&_nc_ht=scontent.fnag1-2.fna&edm=AJdBtusEAAAA&_nc_tpa=Q5bMBQED6EMzZygixb3B72nCh_l9s_8dviSenrdRevn3hvHd-56ypGTuuINwBUlIrfMruUsXa-PQMaXfOA&oh=00_AQCJp84Nqdcjh5imb2d95JDSpV3KJCCRo_S9dCUI_L5xAw&oe=6A74BC3A",
      "width": 50
    }
  }
}
```

---

### ✅ PASS — Get Page Posts

| Field | Value |
|-------|-------|
| **Request** | `GET https://graph.facebook.com/v23.0/1165738093294228/posts?fields=id,message,created_time,permalink_url&limit=5` |
| **HTTP Code** | `200` |
| **Duration** | `555ms` |
| **Status** | ✅ PASS |

**Response:**
```json
{
  "data": []
}
```

---

### ✅ PASS — Publish Test Post

| Field | Value |
|-------|-------|
| **Request** | `POST https://graph.facebook.com/v23.0/1165738093294228/feed` |
| **HTTP Code** | `200` |
| **Duration** | `4803ms` |
| **Status** | ✅ PASS |

**Response:**
```json
{
  "id": "1165738093294228_122093883729399307"
}
```

---

### ❌ FAIL — Get Page Insights

| Field | Value |
|-------|-------|
| **Request** | `GET https://graph.facebook.com/v23.0/1165738093294228/insights?metric=page_impressions,page_engaged_users,page_fan_adds&period=day` |
| **HTTP Code** | `400` |
| **Duration** | `559ms` |
| **Status** | ❌ FAIL |
| **Graph Error** | `[100] (#100) The value must be a valid insights metric (OAuthException)` |

**Response:**
```json
{
  "error": {
    "message": "(#100) The value must be a valid insights metric",
    "type": "OAuthException",
    "code": 100,
    "fbtrace_id": "AopRcG7C9CvH87dfKcN6Yc7"
  }
}
```

---

### ✅ PASS — Get Messenger Conversations

| Field | Value |
|-------|-------|
| **Request** | `GET https://graph.facebook.com/v23.0/1165738093294228/conversations?fields=id,link,participants,updated_time&limit=5` |
| **HTTP Code** | `200` |
| **Duration** | `1623ms` |
| **Status** | ✅ PASS |

**Response:**
```json
{
  "data": []
}
```

---

### ⚠️ SKIP — Send Messenger Test Message

| Field | Value |
|-------|-------|
| **Request** | `POST N/A` |
| **HTTP Code** | `SKIP` |
| **Duration** | `0ms` |
| **Status** | ⚠️ SKIP |
| **Note** | No existing conversation. A real user must first send a message to the page before the reply API can be tested. |

---

### ✅ PASS — Delete Test Post

| Field | Value |
|-------|-------|
| **Request** | `DELETE https://graph.facebook.com/v23.0/1165738093294228_122093883729399307?access_token=***TOKEN***` |
| **HTTP Code** | `200` |
| **Duration** | `5304ms` |
| **Status** | ✅ PASS |

**Response:**
```json
{
  "success": true
}
```

---

### ✅ PASS — Get Subscribed Apps

| Field | Value |
|-------|-------|
| **Request** | `GET https://graph.facebook.com/v23.0/1165738093294228/subscribed_apps` |
| **HTTP Code** | `200` |
| **Duration** | `597ms` |
| **Status** | ✅ PASS |

**Response:**
```json
{
  "data": []
}
```

---

### ✅ PASS — Get Page /me Profile

| Field | Value |
|-------|-------|
| **Request** | `GET https://graph.facebook.com/v23.0/me?fields=id,name` |
| **HTTP Code** | `200` |
| **Duration** | `413ms` |
| **Status** | ✅ PASS |

**Response:**
```json
{
  "id": "1165738093294228",
  "name": "Smriti"
}
```

---

### ✅ PASS — Get IG Profile

| Field | Value |
|-------|-------|
| **Request** | `GET https://graph.facebook.com/v23.0/17841411718913026?fields=id,name,username,biography,followers_count,follows_count,media_count,profile_picture_url,website` |
| **HTTP Code** | `200` |
| **Duration** | `653ms` |
| **Status** | ✅ PASS |

**Response:**
```json
{
  "id": "17841411718913026",
  "name": "SMRITI",
  "username": "smritifyp",
  "biography": "My younger stuff ♥️\nCheck more @smriti.shans \nDm for Promotion",
  "followers_count": 2,
  "follows_count": 0,
  "media_count": 3,
  "profile_picture_url": "https://scontent.fnag1-3.fna.fbcdn.net/v/t51.82787-15/733519690_18170968180390631_6334027041824817854_n.jpg?_nc_cat=100&ccb=1-7&_nc_sid=7d201b&_nc_ohc=fFD17M6W-CEQ7kNvwFiNGm-&_nc_oc=Ado_MNEhrVsP4ZIHp4j8Yhv8xo-vJt2lLSAJ7hCnL4mp_tdtM9kFTGPlqKV2dMQ3uXg&_nc_zt=23&_nc_ht=scontent.fnag1-3.fna&edm=AL-3X8kEAAAA&_nc_gid=V6qiD-ydOtn4PrKPYl0mRQ&oh=00_AQCi4rZV3qjpqWMljA5ascfFb6mdvgLwSozrKTtn6-R1XQ&oe=6A533BD7"
}
```

---

### ✅ PASS — Get IG Media List

| Field | Value |
|-------|-------|
| **Request** | `GET https://graph.facebook.com/v23.0/17841411718913026/media?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count&limit=5` |
| **HTTP Code** | `200` |
| **Duration** | `667ms` |
| **Status** | ✅ PASS |

**Response:**
```json
{
  "data": [
    {
      "id": "18106624709098536",
      "caption": "Just felt like sharing this one ✨\n\n.\n.\n.\n\n#girls #beauty #newpage #growth #fyp",
      "media_type": "VIDEO",
      "media_url": "https://instagram.fnag1-5.fna.fbcdn.net/o1/v/t2/f2/m86/AQNryGyLTk5XzuzhGyTqlp2BBNUOqDf8TmGOvmi-caUP4dYphdVxN8f3m2SPZNGSrAnE-BISSzWdPa9vRcN0xn5D_ftLtL-oTb5_-RU.mp4?_nc_cat=107&_nc_oc=AdqYVG4aut6fI7BSEi500MX-HRgl93zqJUvaPCu1oEXBolF_2ZVkoAgSsweVAbNjAy4&_nc_sid=5e9851&_nc_ht=instagram.fnag1-5.fna.fbcdn.net&_nc_ohc=zl6OnOeuPEEQ7kNvwExk4O8&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzE2LmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTA5NjA5MTU3NjMxOTUzMiwiYXNzZXRfYWdlX2RheXMiOjMsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjo1LCJ1cmxnZW5fc291cmNlIjoid3d3In0%3D&ccb=17-1&vs=93f135707c0e1b4b&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC9FRDQ4ODQ2RUY5ODcwRUJCRThFODQxM0MwRjlGQzU5Rl92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyLzU1NDg2Njk4OEQwQTI4MDE4MkU1QkU1MTYzQzZERkFCX2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACbY-OHQ9rjyAxUCKAJDMywXQBQhysCDEm8YEmRhc2hfYmFzZWxpbmVfMV92MR
... (truncated)
```

---

### ✅ PASS — Get IG Media Comments

| Field | Value |
|-------|-------|
| **Request** | `GET https://graph.facebook.com/v23.0/18106624709098536/comments?fields=id,text,from,timestamp,like_count&limit=5` |
| **HTTP Code** | `200` |
| **Duration** | `670ms` |
| **Status** | ✅ PASS |

**Response:**
```json
{
  "data": []
}
```

---

### ❌ FAIL — Get IG Insights

| Field | Value |
|-------|-------|
| **Request** | `GET https://graph.facebook.com/v23.0/17841411718913026/insights?metric=impressions,reach,profile_views&period=day` |
| **HTTP Code** | `400` |
| **Duration** | `615ms` |
| **Status** | ❌ FAIL |
| **Graph Error** | `[100] (#100) metric[0] must be one of the following values: reach, follower_count, website_clicks, profile_views, online_followers, accounts_engaged, total_interactions, likes, comments, shares, saves, replies, engaged_audience_demographics, reached_audience_demographics, follower_demographics, follows_and_unfollows, profile_links_taps, views, threads_likes, threads_replies, reposts, quotes, threads_followers, threads_follower_demographics, content_views, threads_views, threads_clicks, threads_reposts (OAuthException)` |

**Response:**
```json
{
  "error": {
    "message": "(#100) metric[0] must be one of the following values: reach, follower_count, website_clicks, profile_views, online_followers, accounts_engaged, total_interactions, likes, comments, shares, saves, replies, engaged_audience_demographics, reached_audience_demographics, follower_demographics, follows_and_unfollows, profile_links_taps, views, threads_likes, threads_replies, reposts, quotes, threads_followers, threads_follower_demographics, content_views, threads_views, threads_clicks, threads_reposts",
    "type": "OAuthException",
    "code": 100,
    "fbtrace_id": "AeggHY3QlqzMRQRvKTXy2BV"
  }
}
```

---

### ✅ PASS — Get IG DM Conversations

| Field | Value |
|-------|-------|
| **Request** | `GET https://graph.facebook.com/v23.0/me/conversations?platform=instagram&fields=id,participants,messages{message,from,created_time}&limit=5` |
| **HTTP Code** | `200` |
| **Duration** | `1855ms` |
| **Status** | ✅ PASS |

**Response:**
```json
{
  "data": []
}
```

---

### ⚠️ SKIP — Send Instagram DM

| Field | Value |
|-------|-------|
| **Request** | `POST N/A` |
| **HTTP Code** | `SKIP` |
| **Duration** | `0ms` |
| **Status** | ⚠️ SKIP |
| **Note** | No existing IG conversation. A real user must first DM the @smritifyp account. Only after receiving a message can you reply via API. |

---

### ✅ PASS — Create IG Image Container (test, no publish)

| Field | Value |
|-------|-------|
| **Request** | `POST https://graph.facebook.com/v23.0/17841411718913026/media` |
| **HTTP Code** | `200` |
| **Duration** | `5178ms` |
| **Status** | ✅ PASS |

**Response:**
```json
{
  "id": "18172064650390631"
}
```

---

### ❌ FAIL — Webhook GET Challenge Verify

| Field | Value |
|-------|-------|
| **Request** | `GET https://leadgen-automation-git-beta-agent-harrypeter07s-projects.vercel.app/api/meta/webhook?hub.mode=subscribe&hub.verify_token=***&hub.challenge=LIVE_TEST_CHALLENGE_12345` |
| **HTTP Code** | `200` |
| **Duration** | `1637ms` |
| **Status** | ❌ FAIL |
| **Graph Error** | `Expected challenge echo, got: <!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><link rel="preload" href="/_next/static/media/4473ecc91f70f139-s.p.woff" as="font" crossorigin="" type="font/woff"/><link rel="preload" href="/_next/static/media/463dafcda517f24f-s.p.woff" as="font" crossorigin="" type="font/woff"/><link rel="stylesheet" href="/_next/static/css/2dbb611c2f414db7.css" data-precedence="next"/><link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/webpack-76f2d985752be275.js"/><script src="/_next/static/chunks/fd9d1056-106173975beb4cb2.js" async=""></script><script src="/_next/static/chunks/117-848455eb1ad6db3e.js" async=""></script><script src="/_next/static/chunks/main-app-645c8398551f54f6.js" async=""></script><script src="/_next/static/chunks/64-08d45a0348f61a9d.js" async=""></script><script src="/_next/static/chunks/app/login/page-89588496ebdb47ef.js" async=""></script><script src="/_next/static/chunks/648-3937c90c0e46f239.js" async=""></script><script src="/_next/static/chunks/app/layout-b1999ba58aedda9a.js" async=""></script><title>Lead Gen Dashboard</title><meta name="description" content="View and manage leads from the LeadGen automation pipeline"/><link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="16x16"/><meta name="next-size-adjust"/><script src="/_next/static/chunks/polyfills-42372ed130431b0a.js" noModule=""></script></head><body class="__variable_1e4310 __variable_c3aa02 antialiased"><div data-rht-toaster="" style="position:fixed;z-index:9999;top:16px;left:16px;right:16px;bottom:16px;pointer-events:none"></div><div class="min-h-screen bg-[#141416] flex items-center justify-center relative overflow-hidden font-sans select-none"><div data-rht-toaster="" style="position:fixed;z-index:9999;top:16px;left:16px;right:16px;bottom:16px;pointer-events:none"></div><div class="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-[#E3B859]/5 blur-[120px]"></div><div class="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-purple-600/5 blur-[120px]"></div><div class="w-full max-w-md px-6 z-10 animate-fade-in"><div class="flex flex-col items-center mb-8"><div class="w-14 h-14 rounded-2xl bg-[#E3B859] flex items-center justify-center text-[#141416] font-black text-3xl shadow-xl shadow-[#E3B859]/10 transform hover:scale-105 transition-transform duration-300">Z</div><h1 class="text-2xl font-bold text-white tracking-tight mt-4 flex items-center gap-2"><span>Zarss</span><span class="text-xs uppercase bg-[#252528] text-gray-400 px-2 py-0.5 rounded font-mono font-normal">v3</span></h1><p class="text-gray-500 text-xs mt-1 uppercase tracking-wider font-semibold">Lead intelligence &amp; Outreach Portal</p></div><div class="bg-[#18181A] border border-[#252528] rounded-2xl p-8 shadow-2xl relative"><div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#E3B859] to-transparent opacity-60"></div><h2 class="text-lg font-bold text-white tracking-tight mb-2">Security Verification</h2><p class="text-gray-400 text-xs mb-6">Enter the security credential configured in your env file to unlock access to the system.</p><form class="space-y-5"><div><label class="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2">Access Key / Password</label><div class="relative"><input type="password" placeholder="••••••••••••" class="w-full px-4 py-3 bg-[#202022] border border-[#2e2e32] focus:border-[#E3B859] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none transition-colors duration-250 pr-10 font-mono" value=""/><button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 focus:outline-none"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg></button></div></div><button type="submit" class="w-full py-3 bg-[#E3B859] hover:bg-[#d4ac50] text-[#141416] font-bold rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-[#E3B859]/10 focus:outline-none transition-colors duration-200 flex items-center justify-center gap-2 select-none active:scale-[0.98] transform">Authenticate</button></form></div></div></div><script src="/_next/static/chunks/webpack-76f2d985752be275.js" async=""></script><script>(self.__next_f=self.__next_f||[]).push([0]);self.__next_f.push([2,null])</script><script>self.__next_f.push([1,"1:HL[\"/_next/static/media/4473ecc91f70f139-s.p.woff\",\"font\",{\"crossOrigin\":\"\",\"type\":\"font/woff\"}]\n2:HL[\"/_next/static/media/463dafcda517f24f-s.p.woff\",\"font\",{\"crossOrigin\":\"\",\"type\":\"font/woff\"}]\n3:HL[\"/_next/static/css/2dbb611c2f414db7.css\",\"style\"]\n"])</script><script>self.__next_f.push([1,"4:I[2846,[],\"\"]\n6:I[9107,[],\"ClientPageRoot\"]\n7:I[8991,[\"64\",\"static/chunks/64-08d45a0348f61a9d.js\",\"626\",\"static/chunks/app/login/page-89588496ebdb47ef.js\"],\"default\",1]\n8:I[4707,[],\"\"]\n9:I[6423,[],\"\"]\na:I[62,[\"64\",\"static/chunks/64-08d45a0348f61a9d.js\",\"648\",\"static/chunks/648-3937c90c0e46f239.js\",\"185\",\"static/chunks/app/layout-b1999ba58aedda9a.js\"],\"default\"]\nc:I[1060,[],\"\"]\nd:[]\n"])</script><script>self.__next_f.push([1,"0:[\"$\",\"$L4\",null,{\"buildId\":\"L05TZmmOAhtIqMtE3Mpz_\",\"assetPrefix\":\"\",\"urlParts\":[\"\",\"login\"],\"initialTree\":[\"\",{\"children\":[\"login\",{\"children\":[\"__PAGE__\",{}]}]},\"$undefined\",\"$undefined\",true],\"initialSeedData\":[\"\",{\"children\":[\"login\",{\"children\":[\"__PAGE__\",{},[[\"$L5\",[\"$\",\"$L6\",null,{\"props\":{\"params\":{},\"searchParams\":{}},\"Component\":\"$7\"}],null],null],null]},[null,[\"$\",\"$L8\",null,{\"parallelRouterKey\":\"children\",\"segmentPath\":[\"children\",\"login\",\"children\"],\"error\":\"$undefined\",\"errorStyles\":\"$undefined\",\"errorScripts\":\"$undefined\",\"template\":[\"$\",\"$L9\",null,{}],\"templateStyles\":\"$undefined\",\"templateScripts\":\"$undefined\",\"notFound\":\"$undefined\",\"notFoundStyles\":\"$undefined\"}]],null]},[[[[\"$\",\"link\",\"0\",{\"rel\":\"stylesheet\",\"href\":\"/_next/static/css/2dbb611c2f414db7.css\",\"precedence\":\"next\",\"crossOrigin\":\"$undefined\"}]],[\"$\",\"html\",null,{\"lang\":\"en\",\"children\":[\"$\",\"body\",null,{\"className\":\"__variable_1e4310 __variable_c3aa02 antialiased\",\"children\":[\"$\",\"$La\",null,{\"children\":[\"$\",\"$L8\",null,{\"parallelRouterKey\":\"children\",\"segmentPath\":[\"children\"],\"error\":\"$undefined\",\"errorStyles\":\"$undefined\",\"errorScripts\":\"$undefined\",\"template\":[\"$\",\"$L9\",null,{}],\"templateStyles\":\"$undefined\",\"templateScripts\":\"$undefined\",\"notFound\":[[\"$\",\"title\",null,{\"children\":\"404: This page could not be found.\"}],[\"$\",\"div\",null,{\"style\":{\"fontFamily\":\"system-ui,\\\"Segoe UI\\\",Roboto,Helvetica,Arial,sans-serif,\\\"Apple Color Emoji\\\",\\\"Segoe UI Emoji\\\"\",\"height\":\"100vh\",\"textAlign\":\"center\",\"display\":\"flex\",\"flexDirection\":\"column\",\"alignItems\":\"center\",\"justifyContent\":\"center\"},\"children\":[\"$\",\"div\",null,{\"children\":[[\"$\",\"style\",null,{\"dangerouslySetInnerHTML\":{\"__html\":\"body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}\"}}],[\"$\",\"h1\",null,{\"className\":\"next-error-h1\",\"style\":{\"display\":\"inline-block\",\"margin\":\"0 20px 0 0\",\"padding\":\"0 23px 0 0\",\"fontSize\":24,\"fontWeight\":500,\"verticalAlign\":\"top\",\"lineHeight\":\"49px\"},\"children\":\"404\"}],[\"$\",\"div\",null,{\"style\":{\"display\":\"inline-block\"},\"children\":[\"$\",\"h2\",null,{\"style\":{\"fontSize\":14,\"fontWeight\":400,\"lineHeight\":\"49px\",\"margin\":0},\"children\":\"This page could not be found.\"}]}]]}]}]],\"notFoundStyles\":[]}]}]}]}]],null],null],\"couldBeIntercepted\":false,\"initialHead\":[null,\"$Lb\"],\"globalErrorComponent\":\"$c\",\"missingSlots\":\"$Wd\"}]\n"])</script><script>self.__next_f.push([1,"b:[[\"$\",\"meta\",\"0\",{\"name\":\"viewport\",\"content\":\"width=device-width, initial-scale=1\"}],[\"$\",\"meta\",\"1\",{\"charSet\":\"utf-8\"}],[\"$\",\"title\",\"2\",{\"children\":\"Lead Gen Dashboard\"}],[\"$\",\"meta\",\"3\",{\"name\":\"description\",\"content\":\"View and manage leads from the LeadGen automation pipeline\"}],[\"$\",\"link\",\"4\",{\"rel\":\"icon\",\"href\":\"/favicon.ico\",\"type\":\"image/x-icon\",\"sizes\":\"16x16\"}],[\"$\",\"meta\",\"5\",{\"name\":\"next-size-adjust\"}]]\n5:null\n"])</script></body></html>` |

**Response:**
```json
{
  "body": "<!DOCTYPE html><html lang=\"en\"><head><meta charSet=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/><link rel=\"preload\" href=\"/_next/static/media/4473ecc91f70f139-s.p.woff\" as=\"font\" crossorigin=\"\" type=\"font/woff\"/><link rel=\"preload\" href=\"/_next/static/media/463dafcda517f24f-s.p.woff\" as=\"font\" crossorigin=\"\" type=\"font/woff\"/><link rel=\"stylesheet\" href=\"/_next/static/css/2dbb611c2f414db7.css\" data-precedence=\"next\"/><link rel=\"preload\" as=\"script\" fetchPriority=\"low\" href=\"/_next/static/chunks/webpack-76f2d985752be275.js\"/><script src=\"/_next/static/chunks/fd9d1056-106173975beb4cb2.js\" async=\"\"></script><script src=\"/_next/static/chunks/117-848455eb1ad6db3e.js\" async=\"\"></script><script src=\"/_next/static/chunks/main-app-645c8398551f54f6.js\" async=\"\"></script><script src=\"/_next/static/chunks/64-08d45a0348f61a9d.js\" async=\"\"></script><script src=\"/_next/static/chunks/app/login/page-89588496ebdb47ef.js\" async=\"\"></script><script src=\"/_next/static/chunks/648-3937c90c0e46f239.js\" async=\"\"></script><script src=\"/_next/static/chunks/app/layout-b1999ba58aedda9a.js\" async=\"
... (truncated)
```

---

### ❌ FAIL — Webhook POST Simulated Event

| Field | Value |
|-------|-------|
| **Request** | `POST https://leadgen-automation-git-beta-agent-harrypeter07s-projects.vercel.app/api/meta/webhook` |
| **HTTP Code** | `405` |
| **Duration** | `1041ms` |
| **Status** | ❌ FAIL |
| **Graph Error** | `Unexpected status 405` |
| **Note** | Event accepted by webhook handler. |

**Response:**
```json
{
  "body": ""
}
```

---

## Skipped Tests — User Action Required

### ⚠️ Send Messenger Test Message

**Reason:** No existing conversation. A real user must first send a message to the page before the reply API can be tested.

**What is needed:** A real Facebook user or Instagram user must send a message to the page/account first. The Meta Graph API does not allow sending outbound messages to users who have not initiated contact (policy enforcement).

### ⚠️ Send Instagram DM

**Reason:** No existing IG conversation. A real user must first DM the @smritifyp account. Only after receiving a message can you reply via API.

**What is needed:** A real Facebook user or Instagram user must send a message to the page/account first. The Meta Graph API does not allow sending outbound messages to users who have not initiated contact (policy enforcement).

