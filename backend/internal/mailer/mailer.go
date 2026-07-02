package mailer

import (
	"bytes"
	"context"
	"fmt"
	"mime"
	"net"
	"net/mail"
	"net/smtp"
	"strings"
	"time"

	"github.com/rs/zerolog/log"

	"mappening/internal/config"
)

type Message struct {
	To      string
	Subject string
	Text    string
	HTML    string
}

type Sender interface {
	Send(ctx context.Context, message Message) error
}

type SenderFunc func(ctx context.Context, message Message) error

func (fn SenderFunc) Send(ctx context.Context, message Message) error {
	return fn(ctx, message)
}

func NewSender(cfg config.MailConfig) Sender {
	switch strings.ToLower(strings.TrimSpace(cfg.Mode)) {
	case "smtp":
		return SMTPSender{cfg: cfg}
	case "log":
		return SenderFunc(func(_ context.Context, message Message) error {
			log.Info().
				Str("to", message.To).
				Str("subject", message.Subject).
				Str("body", message.Text).
				Msg("mail queued in log mode")
			return nil
		})
	default:
		return SenderFunc(func(context.Context, Message) error { return nil })
	}
}

type SMTPSender struct {
	cfg config.MailConfig
}

func (s SMTPSender) Send(ctx context.Context, message Message) error {
	if err := validateMessage(message); err != nil {
		return err
	}

	addr := net.JoinHostPort(s.cfg.SMTP.Host, s.cfg.SMTP.Port)
	host := s.cfg.SMTP.Host
	from := s.cfg.From
	raw := buildMIMEMessage(from, s.cfg.FromName, message)

	var auth smtp.Auth
	if s.cfg.SMTP.Username != "" {
		auth = smtp.PlainAuth("", s.cfg.SMTP.Username, s.cfg.SMTP.Password, host)
	}

	errCh := make(chan error, 1)
	go func() {
		errCh <- smtp.SendMail(addr, auth, from, []string{message.To}, raw)
	}()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-errCh:
		if err != nil {
			return fmt.Errorf("send smtp mail: %w", err)
		}
		return nil
	}
}

func validateMessage(message Message) error {
	if _, err := mail.ParseAddress(message.To); err != nil {
		return fmt.Errorf("invalid recipient email")
	}
	if strings.TrimSpace(message.Subject) == "" {
		return fmt.Errorf("mail subject is required")
	}
	if strings.TrimSpace(message.Text) == "" && strings.TrimSpace(message.HTML) == "" {
		return fmt.Errorf("mail body is required")
	}
	return nil
}

func buildMIMEMessage(from string, fromName string, message Message) []byte {
	var buffer bytes.Buffer
	fromAddress := mail.Address{Name: fromName, Address: from}

	headers := map[string]string{
		"From":         fromAddress.String(),
		"To":           message.To,
		"Subject":      mime.QEncoding.Encode("utf-8", message.Subject),
		"Date":         time.Now().Format(time.RFC1123Z),
		"MIME-Version": "1.0",
	}

	if strings.TrimSpace(message.HTML) != "" {
		headers["Content-Type"] = `text/html; charset="utf-8"`
	} else {
		headers["Content-Type"] = `text/plain; charset="utf-8"`
	}
	headers["Content-Transfer-Encoding"] = "8bit"

	for key, value := range headers {
		buffer.WriteString(key)
		buffer.WriteString(": ")
		buffer.WriteString(value)
		buffer.WriteString("\r\n")
	}
	buffer.WriteString("\r\n")
	if strings.TrimSpace(message.HTML) != "" {
		buffer.WriteString(message.HTML)
	} else {
		buffer.WriteString(message.Text)
	}
	return buffer.Bytes()
}
