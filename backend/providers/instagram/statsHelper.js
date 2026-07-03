// backend/providers/instagram/statsHelper.js

class InstagramStatsHelper {
  calculate(profile, rawPosts = [], rawReels = [], options = {}) {
    const { timeframe = 'all', scrapeHistory = true, scrapeReels = true } = options;

    if (!profile) return null;

    // 1. Filter by timeframe if history is enabled
    let posts = scrapeHistory ? [...rawPosts] : [];
    let reels = scrapeReels ? [...rawReels] : [];

    let daysLimit = 0;
    if (timeframe === '1m') daysLimit = 30;
    else if (timeframe === '3m') daysLimit = 90;
    else if (timeframe === '6m') daysLimit = 180;
    else if (timeframe === '1y') daysLimit = 365;

    if (daysLimit > 0) {
      const cutOff = new Date();
      cutOff.setDate(cutOff.getDate() - daysLimit);

      posts = posts.filter(p => p.date && new Date(p.date) >= cutOff);
      reels = reels.filter(r => r.date && new Date(r.date) >= cutOff);
    }

    const allItems = [...posts, ...reels].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const totalCount = allItems.length;

    // 2. Metrics Accumulators
    let totalLikes = 0;
    let totalComments = 0;
    let maxLikes = 0;
    let maxComments = 0;
    let minLikes = totalCount > 0 ? Infinity : 0;
    let minComments = totalCount > 0 ? Infinity : 0;

    let postsCount = 0;
    let postLikes = 0;
    let postComments = 0;

    let reelsCount = 0;
    let reelLikes = 0;
    let reelComments = 0;

    let peakPost = null;
    let maxEngagement = 0;

    allItems.forEach(item => {
      const likes = item.likes_count || 0;
      const comments = item.comments_count || 0;
      const engagement = likes + comments;

      totalLikes += likes;
      totalComments += comments;

      if (likes > maxLikes) maxLikes = likes;
      if (comments > maxComments) maxComments = comments;
      if (likes < minLikes) minLikes = likes;
      if (comments < minComments) minComments = comments;

      if (engagement > maxEngagement) {
        maxEngagement = engagement;
        peakPost = item;
      }

      if (item.type === 'reel') {
        reelsCount++;
        reelLikes += likes;
        reelComments += comments;
      } else {
        postsCount++;
        postLikes += likes;
        postComments += comments;
      }
    });

    if (minLikes === Infinity) minLikes = 0;
    if (minComments === Infinity) minComments = 0;

    // 3. Averages
    const avgLikes = totalCount > 0 ? Math.round(totalLikes / totalCount) : 0;
    const avgComments = totalCount > 0 ? Math.round(totalComments / totalCount) : 0;

    const avgPostLikes = postsCount > 0 ? Math.round(postLikes / postsCount) : 0;
    const avgPostComments = postsCount > 0 ? Math.round(postComments / postsCount) : 0;

    const avgReelLikes = reelsCount > 0 ? Math.round(reelLikes / reelsCount) : 0;
    const avgReelComments = reelsCount > 0 ? Math.round(reelComments / reelsCount) : 0;

    // 4. Engagement Rate
    const followers = profile.followers || 0;
    let engagementRate = 0;
    if (followers > 0 && totalCount > 0) {
      engagementRate = parseFloat((((avgLikes + avgComments) / followers) * 100).toFixed(2));
    }

    // 5. Posting Frequency
    let postsPerWeek = 0;
    if (totalCount > 1) {
      const latestDate = new Date(allItems[0].date).getTime();
      const oldestDate = new Date(allItems[allItems.length - 1].date).getTime();
      const diffDays = Math.max(1, Math.round(Math.abs(latestDate - oldestDate) / (1000 * 60 * 60 * 24)));
      postsPerWeek = parseFloat(((totalCount / diffDays) * 7).toFixed(1));
    } else if (totalCount === 1) {
      postsPerWeek = 0.2; // roughly once a month
    }

    // 6. Consistency Score
    let consistencyScore = 50;
    if (totalCount > 1) {
      // Analyze gaps
      let totalGaps = 0;
      for (let i = 0; i < allItems.length - 1; i++) {
        const d1 = new Date(allItems[i].date).getTime();
        const d2 = new Date(allItems[i + 1].date).getTime();
        totalGaps += Math.max(0, Math.round(Math.abs(d1 - d2) / (1000 * 60 * 60 * 24)));
      }
      const avgGapDays = totalGaps / (totalCount - 1);
      if (avgGapDays <= 2) consistencyScore = 98;
      else if (avgGapDays <= 5) consistencyScore = 88;
      else if (avgGapDays <= 10) consistencyScore = 75;
      else if (avgGapDays <= 20) consistencyScore = 55;
      else consistencyScore = 35;
    } else {
      consistencyScore = profile.posts_count > 100 ? 70 : (profile.posts_count > 20 ? 50 : 30);
    }

    // 7. Health Score
    let healthScore = 50;
    if (profile.bio) healthScore += 10;
    if (profile.website || (profile.bio_links && profile.bio_links.length > 0)) healthScore += 15;
    if (profile.verified) healthScore += 15;
    if (engagementRate > 4) healthScore += 10;
    else if (engagementRate > 2) healthScore += 5;
    
    // Cap health score at 100
    healthScore = Math.min(100, healthScore);

    return {
      timeframe,
      scraped_at: new Date().toISOString(),
      total_analyzed: totalCount,
      likes: {
        average: avgLikes,
        peak: maxLikes,
        min: minLikes,
        total: totalLikes
      },
      comments: {
        average: avgComments,
        peak: maxComments,
        min: minComments,
        total: totalComments
      },
      posts_vs_reels: {
        posts: {
          count: postsCount,
          avg_likes: avgPostLikes,
          avg_comments: avgPostComments
        },
        reels: {
          count: reelsCount,
          avg_likes: avgReelLikes,
          avg_comments: avgReelComments
        }
      },
      engagement_rate: engagementRate,
      posts_per_week: postsPerWeek,
      peak_post: peakPost ? {
        shortcode: peakPost.shortcode,
        url: peakPost.url,
        likes: peakPost.likes_count,
        comments: peakPost.comments_count,
        date: peakPost.date,
        type: peakPost.type,
        caption: peakPost.caption
      } : null,
      insights: {
        health_score: healthScore,
        consistency_score: consistencyScore
      }
    };
  }
}

module.exports = new InstagramStatsHelper();
