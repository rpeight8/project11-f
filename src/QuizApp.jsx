import { useState, useCallback, useEffect } from 'react';
import './QuizApp.css';

const Confetti = () => {
  const emojis = ['🎉', '✨', '🌟'];
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const particleCount = 15;
    const newParticles = Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -20,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      speed: 2 + Math.random() * 2,
      rotation: Math.random() * 360,
      rotationSpeed: 1 + Math.random() * 2,
    }));

    setParticles(newParticles);

    let animationFrameId;
    let lastTime = performance.now();
    let currentParticles = newParticles;

    const animate = currentTime => {
      const deltaTime = (currentTime - lastTime) / 16;
      lastTime = currentTime;

      currentParticles = currentParticles
        .map(particle => ({
          ...particle,
          y: particle.y + particle.speed * deltaTime,
          rotation: particle.rotation + particle.rotationSpeed * deltaTime,
        }))
        .filter(particle => particle.y < 120);

      setParticles(currentParticles);

      if (currentParticles.length > 0) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
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
            transform: `rotate(${particle.rotation}deg)`,
          }}
        >
          {particle.emoji}
        </div>
      ))}
    </div>
  );
};

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

    const socket = new WebSocket('ws://localhost:3000');

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
            color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
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
  }, [playerName]);

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
      <input
        type="text"
        placeholder="Enter your name"
        value={playerName}
        onChange={e => setPlayerName(e.target.value)}
      />
      <button onClick={joinGame}>Join Game</button>
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
      <h2>Waiting for Next Question</h2>
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
