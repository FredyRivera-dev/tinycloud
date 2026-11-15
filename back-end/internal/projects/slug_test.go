package projects

import "testing"

func TestGenerateSlugMatchesSchema(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 200; i++ {
		slug := GenerateSlug()
		if !SlugRegex.MatchString(slug) {
			t.Fatalf("generated slug %q does not match %s", slug, SlugRegex)
		}
		if seen[slug] {
			t.Fatalf("generated duplicate slug %q", slug)
		}
		seen[slug] = true
	}
}
