package projects

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"regexp"
)

var SlugRegex = regexp.MustCompile(`^[a-z0-9-]{3,40}$`)

var slugWords = []string{
	"strawberry", "blueberry", "raspberry", "mango", "kiwi", "melon",
	"cherry", "peach", "plum", "guava", "lychee", "caramel",
	"honey", "cocoa", "vanilla", "mochi", "matcha", "moss",
	"fern", "clover", "willow", "dune", "reef", "pebble",
	"comet", "nebula", "aurora", "luna", "stella", "nova",
	"iris", "indigo", "violet", "amber", "coral", "otter",
	"panda", "koala", "puffin", "axolotl", "biscuit", "button",
	"pudding", "waffle", "bubble",
}

const slugAlphabet = "23456789abcdefghjkmnpqrstuvwxyz"

// GenerateSlug mirrors the original TinyCloud style: a friendly word plus a
// short random suffix, e.g. project-aurora-7k2q.
func GenerateSlug() string {
	n, err := rand.Int(rand.Reader, big.NewInt(int64(len(slugWords))))
	if err != nil {
		return "project-cloud-0000"
	}
	word := slugWords[n.Int64()]
	suffix := make([]byte, 4)
	for i := range suffix {
		j, err := rand.Int(rand.Reader, big.NewInt(int64(len(slugAlphabet))))
		if err != nil {
			suffix[i] = '2'
			continue
		}
		suffix[i] = slugAlphabet[j.Int64()]
	}
	return fmt.Sprintf("project-%s-%s", word, suffix)
}
