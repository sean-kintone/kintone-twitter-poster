const { TwitterApi } = require('twitter-api-v2');

exports.handler = async (event, context) => {
    console.log(event)
    try {
        const body = JSON.parse(event.body || '{}');
        console.log('Received webhook data:', JSON.stringify(body, null, 2));

        // Only process if status is "Post Scheduled"
        if (!body.record || body.record?.Status?.value !== 'Post Scheduled') {
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'Webhook received, but status is not Post Scheduled' })
            };
        }

        const tweetText = body.record?.postContent?.value;
        if (!tweetText) throw new Error('No post content found');

        // Initialize Twitter client
        const client = new TwitterApi({
            appKey: process.env.TWITTER_API_KEY,
            appSecret: process.env.TWITTER_API_SECRET,
            accessToken: process.env.TWITTER_ACCESS_TOKEN,
            accessSecret: process.env.TWITTER_ACCESS_SECRET,
        });

        // Validate Twitter client
        await client.v2.me();

        // Handle image if present
        let mediaId = null;
        const imageFiles = body.record?.imageFile?.value;
        
        if (imageFiles?.[0]) {
            const fileKey = imageFiles[0].fileKey;
            const contentType = imageFiles[0].contentType;
            
            // Fetch image from Kintone
            const response = await fetch(
                `https://${process.env.KINTONE_SUBDOMAIN}.kintone.com/k/v1/file.json?fileKey=${fileKey}`,
                {
                    method: 'GET',
                    headers: { 'X-Cybozu-API-Token': process.env.KINTONE_TOKEN }
                }
            );

            const arrayBuffer = await response.arrayBuffer();
            const imageBuffer = Buffer.from(arrayBuffer);
            // Upload to Twitter
            mediaId = await client.v2.uploadMedia(imageBuffer, {
                media_type: contentType,
                media_category: 'tweet_image'
            });
        }

        // Post tweet
        const tweet = await client.v2.tweet(mediaId ? {
            text: tweetText,
            media: { media_ids: [mediaId] }
        } : {
            text: tweetText
        });

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Tweet posted successfully',
                tweetId: tweet.data.id
            })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};