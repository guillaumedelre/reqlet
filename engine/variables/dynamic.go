package variables

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"
	"time"
)

// resolveDynamic evaluates a Postman dynamic variable by name (without the
// leading $). Returns ("", false) for unknown names.
func resolveDynamic(name string) (string, bool) {
	switch name {
	case "guid":
		return generateGUID(), true
	case "timestamp":
		return fmt.Sprintf("%d", time.Now().Unix()), true
	case "isoTimestamp":
		return time.Now().UTC().Format(time.RFC3339), true
	case "randomInt":
		return fmt.Sprintf("%d", randomInt(0, 1000)), true
	case "randomBoolean":
		if randomInt(0, 2) == 0 {
			return "false", true
		}
		return "true", true
	case "randomAlphaNumeric":
		const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
		return string(chars[randomInt(0, int64(len(chars)))]), true
	case "randomFirstName":
		return pick(firstNames), true
	case "randomLastName":
		return pick(lastNames), true
	case "randomFullName":
		return pick(firstNames) + " " + pick(lastNames), true
	case "randomEmail":
		return strings.ToLower(pick(firstNames)) + "." +
			strings.ToLower(pick(lastNames)) + "@example.com", true
	case "randomUserName":
		return strings.ToLower(pick(firstNames)) +
			fmt.Sprintf("%d", randomInt(10, 999)), true
	case "randomDomainName":
		return strings.ToLower(pick(lastNames)) + ".example.com", true
	case "randomUrl":
		return "https://" + strings.ToLower(pick(lastNames)) + ".example.com", true
	case "randomWord":
		return pick(words), true
	case "randomWords":
		return pick(words) + " " + pick(words) + " " + pick(words), true
	case "randomPhoneNumber":
		return fmt.Sprintf("%03d-%03d-%04d",
			randomInt(100, 999), randomInt(100, 999), randomInt(1000, 9999)), true
	case "randomPassword":
		const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$"
		b := make([]byte, 16)
		for i := range b {
			b[i] = chars[randomInt(0, int64(len(chars)))]
		}
		return string(b), true
	}
	return "", false
}

// generateGUID produces a random UUID v4.
func generateGUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func randomInt(min, max int64) int64 {
	n, _ := rand.Int(rand.Reader, big.NewInt(max-min))
	return n.Int64() + min
}

func pick(list []string) string {
	return list[randomInt(0, int64(len(list)))]
}

var firstNames = []string{
	"James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael",
	"Linda", "William", "Barbara", "David", "Susan", "Richard", "Jessica",
	"Joseph", "Sarah", "Thomas", "Karen", "Charles", "Lisa",
}

var lastNames = []string{
	"Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
	"Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
	"Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
}

var words = []string{
	"alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf",
	"hotel", "india", "juliet", "kilo", "lima", "mike", "november",
	"oscar", "papa", "quebec", "romeo", "sierra", "tango",
}
