package io.eksamadhan.controller;

import io.eksamadhan.model.SocialPage;
import io.eksamadhan.model.Tenant;
import io.eksamadhan.repository.SocialPageRepository;
import io.eksamadhan.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/pages")
@RequiredArgsConstructor
public class PageController {

    private final SocialPageRepository pageRepository;
    private final TenantRepository tenantRepository;

    @GetMapping
    public List<SocialPage> getAllPages(@RequestParam(defaultValue = "demo-tenant-1") String apiKey) {
        return tenantRepository.findByApiKey(apiKey)
                .map(pageRepository::findByTenant)
                .orElse(Collections.emptyList());
    }

    @PostMapping("/seed")
    public String seedDemoData() {
        Tenant tenant = tenantRepository.findByApiKey("demo-tenant-1")
                .orElseGet(() -> tenantRepository.save(Tenant.builder()
                        .name("Demo Business")
                        .apiKey("demo-tenant-1")
                        .build()));

        if (pageRepository.findByTenant(tenant).isEmpty()) {
            pageRepository.save(SocialPage.builder()
                    .pageName("Demo Facebook Page")
                    .pageId("12345")
                    .platform("FACEBOOK")
                    .tenant(tenant)
                    .build());
        }

        return "Data seeded successfully";
    }
}
