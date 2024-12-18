import { useState, useCallback, useEffect } from 'react';
import './QuizApp.css';

const generateSafeColor = () => {
  // Generate RGB values between 0 and 155 to ensure darker colors
  const r = Math.floor(Math.random() * 156);
  const g = Math.floor(Math.random() * 156);
  const b = Math.floor(Math.random() * 156);

  return `#${r.toString(16).padStart(2, '0')}${g
    .toString(16)
    .padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

const Confetti = () => {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const emojis = ['🎉', '🎊', '✨', '⭐', '🌟'];
    const newParticles = Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -20,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      rotation: Math.random() * 360,
      speed: 1 + Math.random() * 1.5, // Reduced speed range (1-2.5)
      rotationSpeed: -2 + Math.random() * 4, // Reduced rotation range
      size: 0.8 + Math.random() * 0.8,
      opacity: 0.8 + Math.random() * 0.2,
    }));

    setParticles(newParticles);

    const interval = setInterval(() => {
      setParticles(particles =>
        particles.map(particle => ({
          ...particle,
          y: particle.y + particle.speed,
          rotation: particle.rotation + particle.rotationSpeed,
          opacity: Math.max(0, particle.opacity - 0.02),
        }))
      );
    }, 16);

    const cleanup = setTimeout(() => {
      clearInterval(interval);
      setParticles([]);
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(cleanup);
    };
  }, []);

  return (
    <div className="confetti-container">
      {particles.map(particle => (
        <div
          key={particle.id}
          className="confetti-particle"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            transform: `rotate(${particle.rotation}deg) scale(${particle.size})`,
            opacity: particle.opacity,
          }}
        >
          {particle.emoji}
        </div>
      ))}
    </div>
  );
};

const WAITING_MESSAGES = [
  'Still waiting for Vitali to get started...',
  'Hoping Vitali can fix the bugs and start soon',
  'Could this be the new DPP application? 🤔',
  'Just waiting for someone to take the lead',
  'Patiently waiting for pizza to arrive',
  'Did you know Vitali prefers decaf coffee?',
  'Waiting for Vitali to deploy...?',
  'Still debugging, or is it just a feature now?',
  'Countdown to chaos... I mean, the game start!',
  'New app, new bugs — let’s go!',
  'When in doubt, blame the Sandbox system performance!',
  'Testing: where dreams and bugs collide',
];

const TypeWriter = () => {
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [delta, setDelta] = useState(100);

  useEffect(() => {
    let timer;
    const tick = () => {
      const currentMessage = WAITING_MESSAGES[messageIndex];

      // Split message into array of characters and emojis
      const chars = Array.from(currentMessage);

      if (isDeleting) {
        if (currentText.length > 0) {
          // Delete by removing last character or emoji
          setCurrentText(prev => {
            const lastChar = prev[prev.length - 1];
            // If last char is emoji surrogate pair, remove both characters
            return prev.slice(0, prev.length - lastChar.length);
          });
        }
        setDelta(30);
      } else {
        if (currentText.length < currentMessage.length) {
          // Add next character or emoji
          const nextChar = chars[currentText.length];
          setCurrentText(prev => prev + nextChar);
        }
        setDelta(80);
      }

      if (!isDeleting && currentText === currentMessage) {
        setDelta(2000);
        setIsDeleting(true);
      } else if (isDeleting && currentText === '') {
        setIsDeleting(false);
        setMessageIndex(prev => (prev + 1) % WAITING_MESSAGES.length);
        setDelta(300);
      }
    };

    timer = setTimeout(tick, delta);
    return () => clearTimeout(timer);
  }, [currentText, delta, isDeleting, messageIndex]);

  return <h2 className="typing-text">{currentText}</h2>;
};

const COLORS = [
  '#1976d2', // Blue
  '#388e3c', // Green
  '#d32f2f', // Red
  '#7b1fa2', // Purple
  '#c2185b', // Pink
  '#f57c00', // Orange
  '#455a64', // Blue Grey
  '#5d4037', // Brown
];

const QuizApp = () => {
  const [ws, setWs] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [gameState, setGameState] = useState('join');
  const [answers, setAnswers] = useState([]);
  const [results, setResults] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [wsInstance, setWsInstance] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [buttonCooldown, setButtonCooldown] = useState(0);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);

  const connectWebSocket = useCallback(() => {
    if (wsInstance) {
      wsInstance.close();
      setWsInstance(null);
    }

    setIsConnecting(true);
    setButtonCooldown(10);
    setGameState('connecting');

    const cooldownInterval = setInterval(() => {
      setButtonCooldown(prev => {
        if (prev <= 1) {
          clearInterval(cooldownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const socket = new WebSocket('ws://89.110.123.46:3000/');
    // const socket = new WebSocket('ws://localhost:3000/');

    socket.onopen = () => {
      console.log('Connected to server');
      setWs(socket);
      setWsInstance(socket);
      setIsConnecting(false);

      socket.send(
        JSON.stringify({
          type: 'JOIN_GAME',
          payload: {
            name: playerName,
            color: selectedColor,
          },
        })
      );
      setGameState('waiting');
    };

    socket.onmessage = event => {
      const data = JSON.parse(event.data);
      handleServerMessage(data);
    };

    socket.onclose = () => {
      console.log('Connection closed');
      setWs(null);
      setIsConnecting(false);
      setGameState('error');
      setPlayerName(null);
    };

    socket.onerror = error => {
      console.error('WebSocket error:', error);
    };

    return socket;
  }, [playerName, selectedColor]);

  const handleServerMessage = data => {
    if (data.type === 'GAME_STATE_UPDATE') {
      const { game, currentQuestion, players } = data.payload;

      if (game.error) {
        setGameState('error');
        setPlayerName(null);
        return;
      }

      if (gameState === 'connecting') {
        return;
      }

      setSelectedAnswer(
        players.find(player => player.name === playerName).answer
      );

      if (currentQuestion) {
        setAnswers(currentQuestion.answers || []);
        setGameState('playing');
      } else {
        setAnswers([]);
        setGameState('waiting');
      }

      if (game.correctAnswer) {
        setResults({
          correctAnswer: game.correctAnswer,
        });
      } else {
        setResults(null);
      }
    }
  };

  const joinGame = () => {
    if (playerName && playerName.length >= 2) {
      connectWebSocket();
    }
  };

  const submitAnswer = answer => {
    if (ws && answers && answers.length > 0 && !results) {
      setSelectedAnswer(answer);
      ws.send(
        JSON.stringify({
          type: 'SUBMIT_ANSWER',
          payload: answer,
        })
      );
    }
  };

  const renderJoinScreen = () => (
    <div className="join-screen">
      <h2>Join Quiz Game</h2>
      <div className="input-container">
        <input
          type="text"
          placeholder="Enter your name"
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
          className={
            playerName.length > 0 && playerName.length < 4 ? 'invalid' : ''
          }
        />
        {playerName.length > 0 && playerName.length < 4 && (
          <span className="input-error">
            Name must be at least 4 characters
          </span>
        )}
      </div>
      <div className="color-picker-container">
        <span className="color-picker-label">Choose your player color:</span>
        <div className="color-picker">
          {COLORS.map(color => (
            <button
              key={color}
              className={`color-option ${
                selectedColor === color ? 'selected' : ''
              }`}
              style={{ backgroundColor: color }}
              onClick={() => setSelectedColor(color)}
              aria-label={`Select ${color} color`}
            />
          ))}
        </div>
      </div>
      <button
        onClick={joinGame}
        disabled={!playerName || playerName.length < 4}
      >
        Join Game
      </button>
    </div>
  );

  const renderAnswers = () => (
    <div className="question-screen">
      <div className="options">
        {answers.map(answer => (
          <div key={answer.id} className="answer-container">
            <button
              onClick={() => submitAnswer(answer.id)}
              className={getAnswerStyles(answer)}
              disabled={results !== null}
            >
              {answer.text}
            </button>
            {results &&
              results.correctAnswer === answer.id &&
              selectedAnswer === answer.id && <Confetti />}
          </div>
        ))}
      </div>
    </div>
  );

  const getAnswerStyles = answer => {
    const classes = [];

    if (results) {
      if (results.correctAnswer === answer.id) {
        classes.push('correct');
      } else if (
        selectedAnswer === answer.id &&
        results.correctAnswer !== answer.id
      ) {
        classes.push('incorrect');
      }
    } else if (selectedAnswer === answer.id) {
      classes.push('selected');
    }

    return classes.join(' ');
  };

  const renderWaitingScreen = () => (
    <div className="waiting-screen">
      <TypeWriter />
    </div>
  );

  const renderErrorScreen = () => (
    <div className="error-screen">
      <h2>Oops! Something went wrong</h2>
      <p>Please refresh the page to try again</p>
      <p className="error-emoji">😅</p>
    </div>
  );

  if (gameState === 'error') {
    return <div className="quiz-app">{renderErrorScreen()}</div>;
  }

  if (gameState === 'join') {
    return <div className="quiz-app">{renderJoinScreen()}</div>;
  }

  return (
    <div className="quiz-app">
      {gameState === 'connecting' && (
        <div className="connecting-screen">
          <h2>Connecting to Server</h2>
          <p>Please wait while we establish connection...</p>
        </div>
      )}
      {gameState === 'playing' && answers.length > 0 && renderAnswers()}
      {(gameState === 'waiting' ||
        (gameState === 'playing' && answers.length === 0)) &&
        renderWaitingScreen()}
    </div>
  );
};

export default QuizApp;
