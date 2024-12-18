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

const TypeWriter = ({ names = ['Vitali', 'someone', 'the host'] }) => {
  const [currentText, setCurrentText] = useState(names[0]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [nameIndex, setNameIndex] = useState(0);
  const [delta, setDelta] = useState(200);

  useEffect(() => {
    let timer;
    const tick = () => {
      const currentName = names[nameIndex];

      if (isDeleting) {
        setCurrentText(prev => prev.substring(0, prev.length - 1));
        setDelta(100);
      } else {
        setCurrentText(currentName.substring(0, currentText.length + 1));
        setDelta(200);
      }

      if (!isDeleting && currentText === currentName) {
        setDelta(2000); // Pause at end
        setIsDeleting(true);
      } else if (isDeleting && currentText === '') {
        setIsDeleting(false);
        setNameIndex(prev => (prev + 1) % names.length);
        setDelta(500); // Pause before typing next
      }
    };

    timer = setTimeout(tick, delta);
    return () => clearTimeout(timer);
  }, [currentText, delta, isDeleting, nameIndex, names]);

  return (
    <span className="typing-name">
      {currentText}
      <span className="cursor" />
    </span>
  );
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

    // const socket = new WebSocket('ws://89.110.123.46:3000/');
    const socket = new WebSocket('ws://localhost:3000/');

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
      <h2>
        <span className="static-text">Waiting for </span>
        <TypeWriter names={['Vitali', 'someone', 'the host']} />
        <span className="static-text"> to start</span>
      </h2>
    </div>
  );

  const renderErrorScreen = () => (
    <div className="error-screen">
      <h2>Connection Error</h2>
      <p>Failed to connect to the game server.</p>
      <button
        onClick={connectWebSocket}
        className="reconnect-button"
        disabled={isConnecting || buttonCooldown > 0}
      >
        {isConnecting
          ? 'Connecting...'
          : buttonCooldown > 0
          ? `Reconnect (${buttonCooldown}s)`
          : 'Reconnect'}
      </button>
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
