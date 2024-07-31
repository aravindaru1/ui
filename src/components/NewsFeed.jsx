import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import '../App.css';
import Groq from "groq-sdk";
import html2canvas from 'html2canvas';
import CryptoJS from 'crypto-js'; // Import CryptoJS

const decryptKey = import.meta.env.VITE_KEY;
const API = import.meta.env.VITE_APIKEY;
const groq = new Groq({ apiKey: API, dangerouslyAllowBrowser: true });

function NewsItem({ news, changedTitle, onShare }) {
  const newsItemRef = useRef(null);

  return (
    <div className="news-item" ref={newsItemRef}>
      <img src={news.news_obj.image_url} alt={news.news_obj.title} crossOrigin="anonymous" />
      <div className="border">
        <h2>{changedTitle}</h2>
        <p>{news.news_obj.content}</p>
      </div>
      <a href={news.news_obj.source_url} target='_blank' className="source-link">Source</a>
      <button onClick={() => onShare(newsItemRef)} className="share-button">Share</button>
    </div>
  );
}

async function getGroqChatCompletion(titles, setChangedTitles) {
  const prompt = titles.map((title, index) => `Title ${index + 1}: ${title}`).join("\n") +
    "\nChange the structure of each title above without changing the actual meaning. Give one direct sentence for each, easy to understand words. Return the results as 'Title 1: changed sentence', 'Title 2: changed sentence', etc.";

  try {
    const response = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "gemma-7b-it",
      max_tokens: 1024,
    });

    const resultContent = response.choices[0]?.message?.content || "";
    const changedSentences = resultContent.split('\n').map(line => {
      const match = line.match(/Title \d+: (.+)/);
      return match ? match[1].trim() : "";
    });

    setChangedTitles(prev => [...prev, ...changedSentences]);

  } catch (error) {
    console.error('Error fetching changed titles:', error);
  }
}

function NewsFeed() {
  const [newsList, setNewsList] = useState([]);
  const [activeNews, setActiveNews] = useState(0);
  const [lastNewsId, setLastNewsId] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [changedTitles, setChangedTitles] = useState([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [showSwipeUp, setShowSwipeUp] = useState(true); // State for swipe-up indicator

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch('https://mynewsapi.vercel.app/news');
        const { data: encryptedData, iv: ivHex } = await response.json();

        const apiKey = decryptKey;

        // Convert hex strings to CryptoJS format
        const key = CryptoJS.enc.Utf8.parse(apiKey);
        const iv = CryptoJS.enc.Hex.parse(ivHex);

        // Decrypt the data
        const decrypted = CryptoJS.AES.decrypt(
          { ciphertext: CryptoJS.enc.Hex.parse(encryptedData) },
          key,
          { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
        );

        const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
        const parsedData = JSON.parse(decryptedText);

        setNewsList(parsedData.news_list);
        if (parsedData && parsedData.data && Array.isArray(parsedData.data.news_list)) {
          setNewsList(parsedData.data.news_list);
        } else {
          console.error('Invalid data structure:', parsedData);
        }

      } catch (error) {
        console.error('Error fetching or decrypting data:', error);
      }
    };

    fetchNews();
  }, []);

  useEffect(() => {
    if (newsList.length > processedCount) {
      const newTitles = newsList.slice(processedCount).map(news => news.news_obj.title);
      getGroqChatCompletion(newTitles, setChangedTitles);
      setProcessedCount(newsList.length);
    }
  }, [newsList, processedCount]);

  const handleScroll = (e) => {
    const scrollTop = e.target.scrollTop;
    const newsItemHeight = document.querySelector('.news-item')?.offsetHeight || 0;
    const newIndex = Math.floor(scrollTop / newsItemHeight);
    setActiveNews(newIndex);

    if (newIndex >= 1 && showSwipeUp) {
      setShowSwipeUp(false); // Hide swipe-up indicator after scrolling past the first news item
    }

    if (newIndex >= newsList.length - 2 && hasMore && !loadingMore) {
      loadMoreNews();
    }
  };

  const loadMoreNews = async () => {
    if (loadingMore) return;

    setLoadingMore(true);
    try {
      const response = await axios.post('https://mynewsapi.vercel.app/news-more', { minNewsId: lastNewsId });

      const { data: encryptedData, iv: ivHex } = response.data;
      if (!encryptedData || !ivHex) {
        throw new Error('Invalid data structure from /news-more');
      }

      const apiKey = decryptKey;

      // Convert hex strings to CryptoJS format
      const key = CryptoJS.enc.Utf8.parse(apiKey);
      const iv = CryptoJS.enc.Hex.parse(ivHex);

      // Decrypt the data
      const decrypted = CryptoJS.AES.decrypt(
        { ciphertext: CryptoJS.enc.Hex.parse(encryptedData) },
        key,
        { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
      );

      const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
      const parsedData = JSON.parse(decryptedText);

      if (parsedData && parsedData.data && Array.isArray(parsedData.data.news_list)) {
        const newNewsList = [...newsList, ...parsedData.data.news_list];
        setNewsList(newNewsList);

        if (parsedData.data.news_list.length > 0) {
          setLastNewsId(parsedData.data.news_list[parsedData.data.news_list.length - 1].hash_id);
        } else {
          setHasMore(false);
        }
      } else {
        throw new Error('Invalid data structure after decryption');
      }
    } catch (error) {
      console.error('Error fetching more news:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleShare = async (newsItemRef) => {
    if (!newsItemRef.current) return;

    const canvas = await html2canvas(newsItemRef.current, { useCORS: true });
    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'news-item.png', { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'News Item',
            text: 'Check out this news item!',
          });
        } catch (error) {
          console.error('Error sharing:', error);
        }
      } else {
        console.error('Sharing not supported');
      }
    });
  };

  return (
    <div
      className="news-feed"
      onScroll={handleScroll}
    >
      {showSwipeUp && (
        <div className="swipe-up-indicator">
          Swipe up for more news
        </div>
      )}
      {newsList.map((news, index) => (
        <NewsItem
          key={`${news.hash_id}_${index}`}
          news={news}
          changedTitle={changedTitles[index]}
          onShare={handleShare}
        />
      ))}
      {loadingMore && <div>Loading more...</div>}
    </div>
  );
}

export default NewsFeed;
